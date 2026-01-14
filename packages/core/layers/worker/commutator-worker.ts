import { Queue } from "../../util/queue";
import {
  CommonDataType,
  type CommutatorConfig,
  CommutatorError,
  type CommutatorValidator,
  type EventNode,
  type Field,
  type FieldRecordValues,
  type FunctionNode,
  NodeType,
  type PureFunctionNode,
  type RefNode,
} from "../commutator";
import {
  type AbstractNodeInstance,
  type NodesRegistry,
  type PinInstance,
  PinInstanceType,
  type PinsRegistry,
  type WiresRegistry,
} from "../schema";
import type { WorkerSnapshot } from "./types";

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

  private constructor(
    private config: CommutatorConfig<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    private validator: CommutatorValidator<DataTypes>,
    private nodesRegistry: NodesRegistry<DataTypes>,
    private pinsRegistry: PinsRegistry<DataTypes>,
    private wiresRegistry: WiresRegistry<DataTypes>,
    snapshot?: WorkerSnapshot,
  ) {
    if (!snapshot) {
      return;
    }

    for (const pinCache of snapshot.pinCache) {
      const pinInstance = this.pinsRegistry.getPinByUuid(pinCache.uuid);

      // Если пин по uuid не нашёлся или это exec-пин, то пропускаем кешированное значение
      if (!pinInstance || pinInstance.dataType === null) {
        continue;
      }

      // Если данные из кеша не соответствуют типу данных пина, то пропускаем кешированное значение
      if (!this.validator.validateFieldValue(pinInstance.dataType, pinCache.cache)) {
        continue;
      }

      this.pinCache.set(pinCache.uuid, pinCache.cache);
    }

    for (const metaCache of snapshot.metaCache) {
      const nodeInstance = this.nodesRegistry.getNodeByUuid(metaCache.uuid);

      // Если нода по uuid не нашлась то пропускаем кешированное значение
      if (!nodeInstance) {
        continue;
      }

      const nodeConfig = this.config.getNodeConfigByName(nodeInstance.name);

      if (!nodeConfig) {
        continue;
      }

      // Если данные из кеша не соответствуют типу метаданных ноды, то пропускаем кешированное значение
      if (!this.validator.validateFieldValue(nodeConfig.meta, metaCache.cache)) {
        continue;
      }

      this.metaCache.set(metaCache.uuid, metaCache.cache);
    }
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
    const runtimePinCache: Map<string, unknown> = new Map();

    const events = this.nodesRegistry.getNodesByName(String(event));

    const nodesToProcess: Queue<{ execPinIn: string; node: AbstractNodeInstance<string> }> =
      new Queue();

    for (const event of events) {
      this.saveToPinCache(this.pinCache, event, payload);

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

      await this.processFunction(runtimePinCache, node, execPinIn);
    }
  }

  private async processFunction(
    runtimePinCache: Map<string, unknown>,
    node: AbstractNodeInstance<string>,
    execPinIn: string,
  ): Promise<AbstractNodeInstance<string>[]> {
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
          let cachedValue = this.pinCache.get(pinOut.uuid);

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

          pinsIn[pin.name] = cachedValue === undefined ? null : cachedValue;
        }
      } else if (pin.default !== undefined) {
        pinsIn[pin.name] = pin.default;
      } else {
        pinsIn[pin.name] = null;
      }
    }

    let meta = this.metaCache.get(node.uuid);

    if (meta === undefined) {
      meta = this.validator.buildDefaultValueFromField(functionConfig.meta);
    }

    // Будем хранить цепочку промисов, которые возвращаются из exec
    let execPromise: Promise<any> = Promise.resolve();

    const exec = async (args: {
      meta: unknown;
      pinsOut: Record<string, unknown>;
      execPinOut: string | null;
    }): Promise<void> => {
      if (args.meta !== undefined) {
        this.metaCache.set(node.uuid, args.meta);
      }

      if (args.pinsOut) {
        this.saveToPinCache(runtimePinCache, node, args.pinsOut);
      }

      // Если вызывается execPinOut – вызываем processFunction и дожидаемся цепочки
      if (args.execPinOut !== null) {
        await execPromise;
        // Эта цепочка может обновиться, если в processFunction снова вызовется exec
        execPromise = this.processFunction(runtimePinCache, node, args.execPinOut);
        await execPromise;
      }
    };

    await functionConfig.exec({
      pinsIn,
      execPinsIn,
      execPinsOut,
      meta,
      config: node.config,
      triggeredExecPinKey: execPinIn,
      exec,
    });

    // Дожидаемся завершения всех вложенных processFunction, если они были вызваны через exec
    await execPromise;

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
          let cachedValue = this.pinCache.get(pinOut.uuid);

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

          pinsIn[pin.name] = cachedValue === undefined ? null : cachedValue;
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

        if (pinValue !== undefined && !this.validator.validateFieldValue(pin.dataType, pinValue)) {
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
  ): void {
    const pins = this.pinsRegistry.getPinsByNodeUuid(node.uuid);

    for (const pin of pins) {
      if (pin.type !== PinInstanceType.Output || pin.dataType === null) {
        continue;
      }

      const pinData = value[pin.name];

      if (pinData === undefined || !this.validator.validateFieldValue(pin.dataType, pinData)) {
        continue;
      }

      pinCache.set(pin.uuid, pinData);
    }
  }

  extract(): WorkerSnapshot {
    return {
      pinCache: Array.from(this.pinCache.entries()).map(([uuid, cache]) => ({ uuid, cache })),
      metaCache: Array.from(this.metaCache.entries()).map(([uuid, cache]) => ({ uuid, cache })),
    };
  }
}
