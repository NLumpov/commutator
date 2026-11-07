import { Queue } from "../../util/queue";
import {
  type CommutatorConfig,
  CommutatorError,
  CommutatorExecutionError,
  type CommutatorValidator,
  type EventNode,
  type Field,
  type FunctionNode,
  NodeType,
  type PureFunctionNode,
  type RefNode,
} from "../commutator";
import {
  type AbstractNodeInstance,
  type NodesRegistry,
  PinInstanceType,
  type PinsRegistry,
  type WiresRegistry,
} from "../schema";
import { snapshotField } from "./snapshot-field";
import { copyJson, readSnapshot, snapshotError } from "./snapshot-json";
import type { WorkerSnapshot } from "./types";

interface ExecutionRun {
  readonly maxSteps: number | undefined;
  cyclic: boolean;
  steps: number;
  synchronousDepth: number;
  limitError?: CommutatorExecutionError;
}

// Cyclic graphs yield before the native callback stack becomes deep. Direct
// input reads still happen on entry; DAG traversal does not acquire a yield.
const MAX_SYNCHRONOUS_CYCLIC_DEPTH = 64;

export class CommutatorWorker<
  DataTypes extends Record<string, Field<DataTypes>>,
  Events extends Record<string, EventNode<DataTypes, any, any, any, any, any, any, any>>,
  Refs extends Record<string, RefNode<DataTypes, any, any, any, any, any, any, any>>,
  PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, any, any, any, any, any, any, any>
  >,
  Functions extends Record<string, FunctionNode<DataTypes, any, any, any, any, any, any, any>>,
  Apis extends Record<string, any>,
> {
  private pinCache: Map<string, unknown> = new Map();
  private metaCache: Map<string, unknown> = new Map();
  private state: "idle" | "running" | "failed" = "idle";

  private constructor(
    private config: CommutatorConfig<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    private validator: CommutatorValidator<DataTypes>,
    private nodesRegistry: NodesRegistry<DataTypes>,
    private pinsRegistry: PinsRegistry<DataTypes>,
    private wiresRegistry: WiresRegistry<DataTypes>,
    snapshot?: WorkerSnapshot,
  ) {
    if (snapshot === undefined) return;
    const restored = this.validateSnapshot(snapshot);
    this.pinCache = new Map(restored.pinCache.map(({ uuid, cache }) => [uuid, cache]));
    this.metaCache = new Map(restored.metaCache.map(({ uuid, cache }) => [uuid, cache]));
  }

  private schemaFingerprint(): string {
    // Canonical graph encoding is collision-free. Array order is execution-significant;
    // callbacks/API implementations are deliberately outside this identity contract.
    const nodes = this.nodesRegistry.getAllNodes().map((node) => ({
      uuid: node.uuid,
      name: node.name,
      type: node.type,
      ...(node.config === undefined ? {} : { config: node.config }),
      meta: snapshotField(this.config.getNodeConfigByName(node.name)?.meta),
    }));
    const pins = this.pinsRegistry.getAllPins().map((pin) => ({
      uuid: pin.uuid,
      nodeUuid: pin.nodeUuid,
      name: pin.name,
      type: pin.type,
      dataType: snapshotField(pin.dataType),
      ...(pin.default === undefined ? {} : { default: pin.default }),
    }));
    return `graph-v1:${JSON.stringify(
      copyJson(
        {
          nodes,
          pins,
          wires: this.wiresRegistry.getAllWires(),
          dataTypes: Object.fromEntries(
            Object.entries(this.config.dataTypes).map(([name, field]) => [
              name,
              snapshotField(field),
            ]),
          ),
        },
        true,
      ),
    )}`;
  }

  private validateSnapshot(input: unknown): WorkerSnapshot {
    const snapshot = readSnapshot(input);
    if (snapshot.schemaFingerprint !== this.schemaFingerprint()) snapshotError("schema mismatch");
    for (const { uuid, cache } of snapshot.pinCache) {
      const pin = this.pinsRegistry.getPinByUuid(uuid);
      const node = pin && this.nodesRegistry.getNodeByUuid(pin.nodeUuid);
      if (
        !pin ||
        pin.type !== PinInstanceType.Output ||
        !pin.dataType ||
        !node ||
        (node.type !== NodeType.Event && node.type !== NodeType.Function) ||
        !this.validator.validateFieldValue(pin.dataType, cache)
      ) {
        snapshotError(`invalid persistent pin ${uuid}`);
      }
    }
    for (const { uuid, cache } of snapshot.metaCache) {
      const node = this.nodesRegistry.getNodeByUuid(uuid);
      const config = node && this.config.getNodeConfigByName(node.name);
      if (
        !node ||
        node.type !== NodeType.Function ||
        !config ||
        (config.meta === undefined
          ? cache !== null
          : !this.validator.validateFieldValue(config.meta, cache))
      ) {
        snapshotError(`invalid metadata ${uuid}`);
      }
    }
    return snapshot;
  }

  public static initialize<
    DataTypes extends Record<string, Field<DataTypes>>,
    Events extends Record<string, EventNode<DataTypes, any, any, any, any, any, any, any>>,
    Refs extends Record<string, RefNode<DataTypes, any, any, any, any, any, any, any>>,
    PureFunctions extends Record<
      string,
      PureFunctionNode<DataTypes, any, any, any, any, any, any, any>
    >,
    Functions extends Record<string, FunctionNode<DataTypes, any, any, any, any, any, any, any>>,
    Apis extends Record<string, any>,
  >(
    config: CommutatorConfig<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    validator: CommutatorValidator<DataTypes>,
    nodesRegistry: NodesRegistry<DataTypes>,
    pinsRegistry: PinsRegistry<DataTypes>,
    wiresRegistry: WiresRegistry<DataTypes>,
    snapshot?: WorkerSnapshot,
  ): CommutatorWorker<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    return new CommutatorWorker(
      config,
      validator,
      nodesRegistry,
      pinsRegistry,
      wiresRegistry,
      snapshot,
    );
  }

  public async triggerEvent<Name extends keyof Events>(
    event: Name,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.assertAvailable();
    this.state = "running";
    try {
      await this.runEvent(event, payload);
      this.state = "idle";
    } catch (error) {
      // processFunction drains its descendants before propagating any failure.
      this.state = "failed";
      throw error;
    }
  }

  private assertAvailable(): void {
    if (this.state === "running") throw new CommutatorExecutionError("WORKER_BUSY");
    if (this.state === "failed") throw new CommutatorExecutionError("WORKER_FAILED");
  }

  private async runEvent<Name extends keyof Events>(
    event: Name,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // Own the input once per API call; Function callbacks share the run's values.
    const input = copyJson(payload);
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      snapshotError("expected event payload object");
    }
    const cyclic = this.wiresRegistry.hasCycle("exec");
    if (cyclic && this.config.maxSteps === undefined) {
      throw new CommutatorExecutionError("MAX_STEPS_REQUIRED");
    }
    const run: ExecutionRun = {
      maxSteps: this.config.maxSteps,
      cyclic,
      steps: 0,
      synchronousDepth: 0,
    };
    const runtimePinCache: Map<string, unknown> = new Map();

    const events = this.nodesRegistry.getNodesByName(String(event));

    const nodesToProcess: Queue<{ execPinIn: string; node: AbstractNodeInstance<string> }> =
      new Queue();

    for (const event of events) {
      this.saveToPinCache(this.pinCache, event, input);

      // Берём все exec пины на выход из ивента
      const eventExecPinsOut = this.pinsRegistry.getNodeOutExecPinsIndex().get(event.uuid);

      if (!eventExecPinsOut) {
        continue;
      }

      // Бежим по всем exec-пинам ивента (обычно 1)
      for (const execPinOut of eventExecPinsOut.values()) {
        const wiresFromExecPin = this.wiresRegistry.getWiresByFromPin(execPinOut.uuid);

        // Бежим по всем проводам из exec-пина (обычно 1)
        for (const wire of wiresFromExecPin) {
          const execPinIn = this.pinsRegistry.getPinByUuid(wire.to);

          if (execPinIn === undefined || execPinIn.type !== PinInstanceType.InputExec) {
            continue;
          }

          const node = this.nodesRegistry.getNodeByUuid(execPinIn.nodeUuid);

          if (node) {
            nodesToProcess.enqueue({ execPinIn: execPinIn.name, node });
          }
        }
      }
    }

    while (nodesToProcess.size > 0) {
      const data = nodesToProcess.dequeue();

      if (!data) break;

      const { node, execPinIn } = data;

      // Ивентов в очереди быть не может
      if (node.type !== NodeType.Function) {
        continue;
      }

      await this.processFunction(run, runtimePinCache, node, execPinIn);
    }
  }

  private async processFunction(
    run: ExecutionRun,
    runtimePinCache: Map<string, unknown>,
    node: AbstractNodeInstance<string>,
    execPinIn: string,
  ): Promise<AbstractNodeInstance<string>[]> {
    // Schemas are editable after a Worker is created. Recheck a newly introduced
    // cycle before admitting its first step (the topology check is cached).
    if (!run.cyclic && this.wiresRegistry.hasCycle("exec")) {
      if (run.maxSteps === undefined) throw new CommutatorExecutionError("MAX_STEPS_REQUIRED");
      run.cyclic = true;
    }
    if (run.limitError) throw run.limitError;
    if (run.maxSteps !== undefined && run.steps >= run.maxSteps) {
      run.limitError = new CommutatorExecutionError("STEP_LIMIT");
      throw run.limitError;
    }
    run.steps++;

    const functionConfig = this.config.functions[node.name];

    if (!functionConfig) {
      throw new CommutatorError(`Function "${node.name}" not found in configuration`);
    }

    const pins = this.pinsRegistry.getPinsByNodeUuid(node.uuid);
    const pinsIn: Record<string, unknown> = {};
    const pinsOut: Record<string, Field<DataTypes>> = {};
    const execPinsIn: Record<string, null> = {};
    const execPinsOut: Record<string, null> = {};

    for (const pin of pins) {
      if (pin.type === PinInstanceType.Output && pin.dataType !== null) {
        pinsOut[pin.name] = pin.dataType;
        continue;
      }
      if (pin.type === PinInstanceType.InputExec) {
        execPinsIn[pin.name] = null;
        continue;
      }
      if (pin.type === PinInstanceType.OutputExec) {
        execPinsOut[pin.name] = null;
        continue;
      }
      if (pin.type !== PinInstanceType.Input || pin.dataType === null) {
        continue;
      }

      const wires = this.wiresRegistry.getWiresByToPin(pin.uuid);

      if (wires[0]) {
        const pinOut = this.pinsRegistry.getPinByUuid(wires[0].from);

        if (!pinOut) {
          throw new CommutatorError(`Pin not found: "${wires[0].from}"`);
        }

        const pinNode = this.nodesRegistry.getNodeByUuid(pinOut.nodeUuid);

        if (!pinNode) {
          throw new CommutatorError(`Node not found: "${pinOut.nodeUuid}"`);
        }

        if (pinNode.type === NodeType.Event) {
          const cachedValue = this.pinCache.get(pinOut.uuid);

          pinsIn[pin.name] = cachedValue === undefined ? null : cachedValue;
        }

        if (pinNode.type === NodeType.Ref) {
          let cachedValue = runtimePinCache.get(pinOut.uuid);

          // Если один из пинов вернул undefined, то значит что надо обрабатывать реф
          if (cachedValue === undefined) {
            await this.processRef(runtimePinCache, pinNode);
            cachedValue = runtimePinCache.get(pinOut.uuid);
          }

          pinsIn[pin.name] = cachedValue === undefined ? null : cachedValue;
        }

        if (pinNode.type === NodeType.PureFunction) {
          let cachedValue = runtimePinCache.get(pinOut.uuid);

          if (cachedValue === undefined) {
            await this.processPureFunction(runtimePinCache, pinNode);
            cachedValue = runtimePinCache.get(pinOut.uuid);
          }

          pinsIn[pin.name] = cachedValue === undefined ? null : cachedValue;
        }

        if (pinNode.type === NodeType.Function) {
          let cachedValue = this.pinCache.get(pinOut.uuid);

          if (cachedValue === undefined) {
            cachedValue = null;
          }

          pinsIn[pin.name] = cachedValue;
        }
      } else if (pin.default !== undefined) {
        pinsIn[pin.name] = pin.default;
      } else {
        pinsIn[pin.name] = null;
      }
    }

    let meta = this.metaCache.get(node.uuid);

    if (meta === undefined && functionConfig.meta !== undefined) {
      meta = this.validator.buildDefaultValueFromField(functionConfig.meta);
    }

    let pendingExecCount = 0;
    let open = true;
    let resolveDrain: (() => void) | undefined;
    let failed = false;
    let failure: unknown;
    const recordFailure = (error: unknown): void => {
      if (!failed) {
        failed = true;
        failure = error;
      }
    };
    const settleExec = (): void => {
      if (--pendingExecCount === 0) {
        const resolve = resolveDrain;
        resolveDrain = undefined;
        resolve?.();
      }
    };
    const rejectExec = (error: unknown): void => {
      recordFailure(error);
      settleExec();
    };

    const runExec = async (args: {
      meta: unknown;
      pinsOut: Record<string, unknown>;
      execPinOut: string | null;
    }): Promise<void> => {
      if (args.pinsOut) {
        this.saveToPinCache(runtimePinCache, node, args.pinsOut, this.pinCache);
      }

      // Publish meta only after every supplied output has passed validation.
      if (args.meta !== undefined) {
        this.metaCache.set(node.uuid, args.meta);
      }

      // Если вызывается execPinOut – находим подключенные ноды и вызываем processFunction для них
      if (args.execPinOut === null) {
        return;
      }

      // Находим exec output пин текущей ноды по имени
      const execPinOutInstance = pins.find(
        (p) => p.type === PinInstanceType.OutputExec && p.name === args.execPinOut,
      );

      if (!execPinOutInstance) {
        return;
      }

      // Получаем все провода из этого exec-пина
      const wiresFromExecPin = this.wiresRegistry.getWiresByFromPin(execPinOutInstance.uuid);

      // Обрабатываем каждую подключенную ноду последовательно
      for (const wire of wiresFromExecPin) {
        const targetExecPinIn = this.pinsRegistry.getPinByUuid(wire.to);

        if (!targetExecPinIn || targetExecPinIn.type !== PinInstanceType.InputExec) {
          continue;
        }

        const targetNode = this.nodesRegistry.getNodeByUuid(targetExecPinIn.nodeUuid);

        if (!targetNode || targetNode.type !== NodeType.Function) {
          continue;
        }

        // Вызываем processFunction для подключенной ноды и ждём завершения
        await this.processFunction(run, runtimePinCache, targetNode, targetExecPinIn.name);
      }
    };

    const exec = (args: Parameters<typeof runExec>[0]): Promise<void> => {
      if (!open) {
        const rejected = Promise.reject<void>(new CommutatorExecutionError("EXEC_CONTEXT_CLOSED"));
        // Match live exec: ignored calls are observed, awaited calls still reject.
        void rejected.catch(() => {});
        return rejected;
      }
      // Start immediately, preserving continuation input reads and await exec ordering.
      const promise = runExec(args);
      pendingExecCount++;
      // Observe failures immediately, even while the author's async body is still running.
      // The original promise still rejects for callers and the final join below.
      void promise.then(settleExec, rejectExec);
      return promise;
    };

    if (run.cyclic && run.synchronousDepth >= MAX_SYNCHRONOUS_CYCLIC_DEPTH) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    try {
      // Another branch may have exhausted the run while inputs or the yield
      // were pending. In that case do not start another user callback.
      if (run.limitError) throw run.limitError;
      let execution: Promise<void>;
      run.synchronousDepth++;
      try {
        execution = functionConfig.exec({
          pinsIn,
          execPinsIn,
          execPinsOut,
          meta,
          config: node.config,
          triggeredExecPinKey: execPinIn,
          exec,
        });
      } finally {
        run.synchronousDepth--;
      }
      await execution;
    } catch (error) {
      recordFailure(error);
    }

    // Дожидаемся завершения всех вызовов exec, включая валидацию выходов
    // Это нужно на случай, если пользователь вызвал exec() без await
    // Completion handlers may issue another exec before a drained wave resumes.
    while (pendingExecCount > 0) {
      await new Promise<void>((resolve) => {
        resolveDrain = resolve;
      });
    }

    // Keep the context open for native continuation handlers while draining;
    // after closure a retained exec must never publish into this or a later run.
    open = false;

    if (run.limitError) throw run.limitError;
    if (failed) throw failure;

    return [];
  }

  private async processPureFunction(
    runtimePinCache: Map<string, unknown>,
    node: AbstractNodeInstance<string>,
  ): Promise<void> {
    const pureFunctionConfig = this.config.pureFunctions[node.name];

    if (!pureFunctionConfig) {
      throw new CommutatorError(`Pure function "${node.name}" not found in configuration`);
    }

    const pins = this.pinsRegistry.getPinsByNodeUuid(node.uuid);

    const pinsIn: Record<string, unknown> = {};
    const pinsOut: Record<string, Field<DataTypes>> = {};

    for (const pin of pins) {
      if (pin.type === PinInstanceType.Output && pin.dataType !== null) {
        pinsOut[pin.name] = pin.dataType;
        continue;
      }

      if (pin.type !== PinInstanceType.Input || pin.dataType === null) {
        continue;
      }

      const wires = this.wiresRegistry.getWiresByToPin(pin.uuid);

      if (wires[0]) {
        const pinOut = this.pinsRegistry.getPinByUuid(wires[0].from);

        if (!pinOut) {
          throw new CommutatorError(`Pin not found: "${wires[0].from}"`);
        }

        const pinNode = this.nodesRegistry.getNodeByUuid(pinOut.nodeUuid);

        if (!pinNode) {
          throw new CommutatorError(`Node not found: "${pinOut.nodeUuid}"`);
        }

        if (pinNode.type === NodeType.Event) {
          const cachedValue = this.pinCache.get(pinOut.uuid);

          pinsIn[pin.name] = cachedValue === undefined ? null : cachedValue;
        }

        if (pinNode.type === NodeType.Ref) {
          let cachedValue = runtimePinCache.get(pinOut.uuid);

          // Если один из пинов вернул undefined, то значит что надо обрабатывать реф
          if (cachedValue === undefined) {
            await this.processRef(runtimePinCache, pinNode);
            cachedValue = runtimePinCache.get(pinOut.uuid);
          }

          pinsIn[pin.name] = cachedValue === undefined ? null : cachedValue;
        }

        if (pinNode.type === NodeType.PureFunction) {
          let cachedValue = runtimePinCache.get(pinOut.uuid);

          if (cachedValue === undefined) {
            await this.processPureFunction(runtimePinCache, pinNode);
            cachedValue = runtimePinCache.get(pinOut.uuid);
          }

          pinsIn[pin.name] = cachedValue === undefined ? null : cachedValue;
        }

        if (pinNode.type === NodeType.Function) {
          let cachedValue = this.pinCache.get(pinOut.uuid);

          if (cachedValue === undefined) {
            cachedValue = null;
          }

          pinsIn[pin.name] = cachedValue;
        }
      } else if (pin.default !== undefined) {
        pinsIn[pin.name] = pin.default;
      } else {
        pinsIn[pin.name] = null;
      }
    }

    const result = await pureFunctionConfig.exec({
      pinsIn,
      pinsOut,
      config: node.config,
    });

    this.saveToPinCache(runtimePinCache, node, result);
  }

  private async processRef(
    runtimePinCache: Map<string, unknown>,
    node: AbstractNodeInstance<string>,
  ): Promise<void> {
    const refConfig = this.config.refs[node.name];

    if (!refConfig) {
      throw new CommutatorError(`Ref "${node.name}" not found in configuration`);
    }

    const pinsOut = this.pinsRegistry.getPinsByNodeUuid(node.uuid);
    let needToResolve = false;

    for (const pin of pinsOut) {
      if (pin.type !== PinInstanceType.Output || pin.dataType === null) {
        continue;
      }

      const pinCache = runtimePinCache.get(pin.uuid);

      // Если кеш пина существует и данные из кеша соответствуют типу данных пина, то пропускаем кешированное значение
      if (pinCache !== undefined && this.validator.validateFieldValue(pin.dataType, pinCache)) {
        continue;
      }

      needToResolve = true;
      // Как только выясняем что хотя бы одного значения нет в кеше - перезагружаем реф
      break;
    }

    if (needToResolve) {
      const pinData = await refConfig.resolveRef({
        pinsOut: pinsOut,
        config: node.config,
        api: this.config.apis,
      });

      for (const pin of pinsOut) {
        if (pin.type !== PinInstanceType.Output || pin.dataType === null) {
          continue;
        }

        if (pinData === null) {
          runtimePinCache.set(pin.uuid, null);
          continue;
        }

        const pinValue = pinData[pin.name];

        if (pinValue !== undefined && this.validator.validateFieldValue(pin.dataType, pinValue)) {
          runtimePinCache.set(pin.uuid, pinValue);
          continue;
        }

        // Если значение не соответствует типу данных пина, то ставим null на момент выполнения
        runtimePinCache.set(pin.uuid, null);
      }
    }
  }

  private saveToPinCache(
    pinCache: Map<string, unknown>,
    node: AbstractNodeInstance<string>,
    value: Record<string, unknown>,
    persistentPinCache?: Map<string, unknown>,
  ): void {
    const pins = this.pinsRegistry.getPinsByNodeUuid(node.uuid);
    let firstUuid: string | undefined;
    let firstValue: unknown;
    let remainingValues: unknown[] | undefined;

    for (let index = 0; index < pins.length; index++) {
      const pin = pins[index];
      if (!pin || pin.type !== PinInstanceType.Output || pin.dataType === null) {
        continue;
      }

      const pinData = value[pin.name];

      if (pinData === undefined) {
        if (Object.hasOwn(value, pin.name)) snapshotError(`non-JSON output ${pin.name}`);
        continue;
      }

      if (!this.validator.validateFieldValue(pin.dataType, pinData)) {
        throw new CommutatorError(
          `Invalid value for output pin "${pin.name}" of node "${node.name}"`,
        );
      }

      if (firstUuid === undefined) {
        firstUuid = pin.uuid;
        firstValue = pinData;
      } else {
        // Read outputs once; getters may change their value on a second read.
        remainingValues ??= [];
        remainingValues[index] = pinData;
      }
    }

    // No staging array for empty/single outputs. Publish only after full validation.
    if (firstUuid !== undefined) {
      pinCache.set(firstUuid, firstValue);
      persistentPinCache?.set(firstUuid, firstValue);
    }
    if (remainingValues) {
      for (let index = 0; index < remainingValues.length; index++) {
        const pinData = remainingValues[index];
        const pin = pins[index];
        if (pinData !== undefined && pin) {
          pinCache.set(pin.uuid, pinData);
          persistentPinCache?.set(pin.uuid, pinData);
        }
      }
    }
  }

  extract(): WorkerSnapshot {
    this.assertAvailable();
    return this.validateSnapshot({
      schemaFingerprint: this.schemaFingerprint(),
      pinCache: Array.from(this.pinCache.entries()).map(([uuid, cache]) => ({ uuid, cache })),
      metaCache: Array.from(this.metaCache.entries()).map(([uuid, cache]) => ({ uuid, cache })),
    });
  }
}
