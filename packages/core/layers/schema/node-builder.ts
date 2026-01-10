import type { CommutatorSchema } from "./commutator-schema";
import type { FluentNodeBuilder } from "./fluent-node-builder";
import { PinBuilder } from "./pin-builder";

/**
 * Builder для работы с нодой в fluent API стиле
 */
export class NodeBuilder<
  const DataTypes extends Record<string, any> = {},
  const Events extends Record<string, any> = {},
  const Refs extends Record<string, any> = {},
  const PureFunctions extends Record<string, any> = {},
  const Functions extends Record<string, any> = {},
  const Apis extends Record<string, any> = {},
> {
  constructor(
    private schema: CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    private nodeUuid: string,
  ) {}

  /**
   * Получить пин по имени для дальнейшей работы с ним
   */
  pin(pinName: string): PinBuilder<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    const pin = this.schema.getPin(this.nodeUuid, pinName);
    return new PinBuilder(this.schema, pin.uuid);
  }

  /**
   * Подключить пин этой ноды к другому пину
   */
  wireTo(
    fromPinName: string,
    toNodeUuid: string | FluentNodeBuilder<any, any, any, any, any, any, any>,
    toPinName: string,
  ): CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    const resolvedToNodeUuid =
      typeof toNodeUuid === "string" ? toNodeUuid : toNodeUuid.instance.uuid;
    this.schema.wire(this.nodeUuid, fromPinName, resolvedToNodeUuid, toPinName);
    return this.schema;
  }

  /**
   * Получить UUID ноды
   */
  get uuid(): string {
    return this.nodeUuid;
  }
}
