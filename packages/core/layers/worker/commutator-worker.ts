import { Queue } from "../../util/queue";
import {
  type CommutatorConfig,
  type CommutatorValidator,
  type EventNode,
  type Field,
  type FunctionNode,
  NodeType,
  type PureFunctionNode,
  type RefNode,
} from "../commutator";
import type { AbstractNodeInstance, NodesRegistry, PinsRegistry, WiresRegistry } from "../schema";
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
    payload: NonNullable<Events[Name]["config"]>,
  ): Promise<void> {
    const runtimePinCache: Map<string, unknown> = new Map();

    const events = this.nodesRegistry.getNodesByName(String(event));

    const nodesToProcess: Queue<AbstractNodeInstance<string>> = new Queue();

    const nodeTypeToProcessor = {
      [NodeType.Function]: this.processFunction,
      [NodeType.PureFunction]: this.processPureFunction,
      [NodeType.Ref]: this.processRef,
    } as const;

    for (const event of events) {
      nodesToProcess.enqueue(event);
    }

    while (nodesToProcess.size > 0) {
      const node = nodesToProcess.dequeue();

      if (!node) break;

      if (node.type === NodeType.Event) {
        continue;
      }

      const processor = nodeTypeToProcessor[node.type];

      if (!processor) {
        continue;
      }

      for (const nextNode of await processor(runtimePinCache, node)) {
        nodesToProcess.enqueue(nextNode);
      }
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
  ): Promise<AbstractNodeInstance<string>[]> {
    return [];
  }

  private async processRef(
    runtimePinCache: Map<string, unknown>,
    node: AbstractNodeInstance<string>,
  ): Promise<AbstractNodeInstance<string>[]> {
    return [];
  }
}
