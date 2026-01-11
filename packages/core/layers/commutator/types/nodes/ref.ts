import type { NodeType } from "../../enums";
import type { Field, FieldRecordValues, FieldValue } from "../";
import type { AbstractNode } from "./abstract";

export interface RefNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
  Config extends Field<DataTypes> | undefined,
  Apis extends Record<string, any>,
  PinsIn extends Record<string, Field<DataTypes>>,
  PinsOut extends Record<string, Field<DataTypes>>,
  ExecPinsIn extends Record<string, null>,
  ExecPinsOut extends Record<string, null>,
> extends AbstractNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut, Apis> {
  readonly type: NodeType.Ref;
  /**
   * Метод для резолва рефа, вызывается в момент подгрузки сущности из пина.
   * Берёт из метаданных информацию о местонахождении сущности, подгружает сущность и возвращает её.
   */
  readonly resolveRef: (args: {
    pinsOut: PinsOut;
    config: Config extends Field<DataTypes> ? FieldValue<Config, DataTypes> : never;
    api: Apis;
  }) => Promise<FieldRecordValues<PinsOut, DataTypes> | null>;
}
