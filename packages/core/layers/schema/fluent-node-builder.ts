import type { CommutatorSchema } from "./commutator-schema";
import type { AbstractNodeInstance } from "./types/node-instances/abstract";

/**
 * Builder для fluent API при создании нод
 * Свойства ноды доступны через instance.
 */
export class FluentNodeBuilder<
  const DataTypes extends Record<string, any> = {},
  const Events extends Record<string, any> = {},
  const Refs extends Record<string, any> = {},
  const PureFunctions extends Record<string, any> = {},
  const Functions extends Record<string, any> = {},
  const Apis extends Record<string, any> = {},
  NodeInstance extends AbstractNodeInstance<any> = AbstractNodeInstance<any>,
> {
  constructor(
    private schema: CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    public readonly instance: NodeInstance,
  ) {}

  /**
   * Подключить пин этой ноды к другому пину
   */
  wire(
    fromPinName: string,
    toNodeUuid: string | FluentNodeBuilder<any, any, any, any, any, any, any>,
    toPinName: string,
  ): FluentNodeBuilder<DataTypes, Events, Refs, PureFunctions, Functions, Apis, NodeInstance> {
    const resolvedToNodeUuid =
      typeof toNodeUuid === "string" ? toNodeUuid : toNodeUuid.instance.uuid;
    this.schema.wire({
      from: { node: this.instance.uuid, pin: fromPinName },
      to: { node: resolvedToNodeUuid, pin: toPinName },
    });
    return this;
  }
}
