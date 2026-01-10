import type { CommutatorSchema } from "./commutator-schema";
import type { AbstractNodeInstance } from "./types/node-instances/abstract";

/**
 * Builder для fluent API при создании нод
 * Делегирует все свойства инстанса ноды для обратной совместимости
 */
export class FluentNodeBuilder<
  const DataTypes extends Record<string, any> = {},
  const Events extends Record<string, any> = {},
  const Refs extends Record<string, any> = {},
  const PureFunctions extends Record<string, any> = {},
  const Functions extends Record<string, any> = {},
  const Apis extends Record<string, any> = {},
  NodeInstance extends AbstractNodeInstance<any> = AbstractNodeInstance<any>,
> implements AbstractNodeInstance<any>
{
  constructor(
    private schema: CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    public readonly instance: NodeInstance,
  ) {}

  // Делегирование свойств инстанса для обратной совместимости
  get uuid(): string {
    return this.instance.uuid;
  }

  get type(): NodeInstance["type"] {
    return this.instance.type;
  }

  get name(): NodeInstance["name"] {
    return this.instance.name;
  }

  get config(): NodeInstance["config"] {
    return this.instance.config;
  }

  get x(): number {
    return this.instance.x;
  }

  set x(value: number) {
    this.instance.x = value;
  }

  get y(): number {
    return this.instance.y;
  }

  set y(value: number) {
    this.instance.y = value;
  }

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
    this.schema.wire(this.instance.uuid, fromPinName, resolvedToNodeUuid, toPinName);
    return this;
  }
}
