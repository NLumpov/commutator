import type { NodeType } from "@enums/node-type";
import type { Field, FieldValue } from "@declarations/field";
import type { ExecPin, Pin, PinRecordValue } from "@declarations/pin";
import type { AbstractNode } from "@declarations/nodes";

export interface RefNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<
    string,
    AbstractNode<DataTypes, Nodes, Meta, any, any, any, any, any>
  >,
  Meta extends Field<DataTypes>,
  Name extends keyof Nodes,
  PinsIn extends Record<string, Pin<DataTypes>>,
  PinsOut extends Record<string, Pin<DataTypes>>,
  ExecPinsIn extends Record<string, ExecPin>,
  ExecPinsOut extends Record<string, ExecPin>
> extends AbstractNode<
    DataTypes,
    Nodes,
    Meta,
    Name,
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
    meta: FieldValue<Field<DataTypes>, DataTypes>;
  }) => Promise<PinRecordValue<PinsOut, DataTypes> | null>;
}
