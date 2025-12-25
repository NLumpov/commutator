import type { NodeType } from "../../enums";
import type { Field, FieldValue } from "../field";
import type { ExecPin, Pin, PinRecordValue } from "../pin";
import type { AbstractNode } from "./abstract";

export interface RefNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Apis extends Record<string, any>,
  Meta extends Field<DataTypes>,
  PinsIn extends Record<string, Pin<DataTypes>>,
  PinsOut extends Record<string, Pin<DataTypes>>,
  ExecPinsIn extends Record<string, ExecPin>,
  ExecPinsOut extends Record<string, ExecPin>
> extends AbstractNode<
    DataTypes,
    Meta,
    PinsIn,
    PinsOut,
    ExecPinsIn,
    ExecPinsOut
  > {
  readonly type: NodeType.Ref;
  /**
   * Метод для резолва рефа, вызывается в момент подгрузки сущности из пина.
   * Берёт из метаданных информацию о местонахождении сущности, подгружает сущность и возвращает её.
   */
  readonly resolveRef: (args: {
    pinsOut: PinsOut;
    meta: FieldValue<Meta, DataTypes>;
    api: Apis;
  }) => Promise<PinRecordValue<PinsOut, DataTypes> | null>;
}
