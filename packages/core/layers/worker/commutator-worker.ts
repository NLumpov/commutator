import { Queue } from "../../util/queue";
import {
  type CommutatorConfig,
  CommutatorError,
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

    const nodesToProcess: Queue<AbstractNodeInstance<string>> = new Queue();

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
          const nodeToEnqueue = this.nodesRegistry.getNodeByUuid(wire.to);

          if (nodeToEnqueue) {
            nodesToProcess.enqueue(nodeToEnqueue);
          }
        }
      }
    }

    while (nodesToProcess.size > 0) {
      const node = nodesToProcess.dequeue();

      if (!node) break;

      // Ивентов в очереди быть не может
      if (node.type !== NodeType.Function) {
        continue;
      }

      await this.processFunction(runtimePinCache, node);
    }
  }

  private async processFunction(
    runtimePinCache: Map<string, unknown>,
    node: AbstractNodeInstance<string>,
  ): Promise<AbstractNodeInstance<string>[]> {
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

    const pinsIn = this.pinsRegistry.getPinsByNodeUuid(node.uuid);
    const pinsOut = this.pinsRegistry.getPinsByNodeUuid(node.uuid);

    for (const pinIn of pinsIn) {
      if (pinIn.type !== PinInstanceType.Input || pinIn.dataType === null) {
        continue;
      }

      const wires = this.wiresRegistry.getWiresByToPin(pinIn.uuid);

      if (wires.length > 0) {
        for (const wire of wires) {
          const pinFrom = this.pinsRegistry.getPinByUuid(wire.from);

          if (!pinFrom) {
            throw new CommutatorError(`Pin not found: "${wire.from}"`);
          }

          const pinNode = this.nodesRegistry.getNodeByUuid(pinFrom.nodeUuid);

          if (!pinNode) {
            throw new CommutatorError(`Node not found: "${pinFrom.nodeUuid}"`);
          }

          if (pinNode.type === NodeType.Event) {
          }
        }
      } else if (pinIn.default !== undefined) {
        runtimePinCache.set(pinIn.uuid, pinIn.default);
      } else {
        throw new CommutatorError(`Pin "${pinIn.uuid}" has no default value and no wires`);
      }
    }
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
}
