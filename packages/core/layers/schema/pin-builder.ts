import type { Pin } from "../commutator/types/pin";
import type { CommutatorSchema } from "./commutator-schema";
import type { FluentNodeBuilder } from "./fluent-node-builder";
import type { PinInstance } from "./types/pin-instance";

/**
 * Builder для работы с пином в fluent API стиле
 */
export class PinBuilder<
  const DataTypes extends Record<string, any> = {},
  const Events extends Record<string, any> = {},
  const Refs extends Record<string, any> = {},
  const PureFunctions extends Record<string, any> = {},
  const Functions extends Record<string, any> = {},
  const Apis extends Record<string, any> = {},
> {
  constructor(
    private schema: CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    private pinUuid: string,
  ) {}

  /**
   * Подключить этот пин к другому пину
   */
  wireTo(
    toNodeUuid: string | FluentNodeBuilder<any, any, any, any, any, any, any>,
    toPinName: string,
  ): CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    const pin = this.instance;
    const nodeUuid = pin.nodeUuid;
    const pinName = pin.name;
    const resolvedToNodeUuid =
      typeof toNodeUuid === "string" ? toNodeUuid : toNodeUuid.instance.uuid;
    this.schema.wire(nodeUuid, pinName, resolvedToNodeUuid, toPinName);
    return this.schema;
  }

  /**
   * Обновить пин
   */
  update(args: {
    name?: string;
    pinType?: Pin<DataTypes>["type"];
  }): CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    this.schema.updatePin(this.pinUuid, args);
    return this.schema;
  }

  /**
   * Получить UUID пина
   */
  get uuid(): string {
    return this.pinUuid;
  }

  /**
   * Получить экземпляр пина
   */
  get instance(): PinInstance<DataTypes> {
    // Используем приватное поле через any для доступа к pinInstances
    const schemaAny = this.schema as any;
    const pin = schemaAny.pinInstances?.get(this.pinUuid);
    if (!pin) {
      throw new Error(`Pin with UUID "${this.pinUuid}" not found`);
    }
    return pin as PinInstance<DataTypes>;
  }
}
