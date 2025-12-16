import type { NodeType } from "@enums/node-type";
import type { Field, FieldValue } from "@declarations/field";
import type { Pin, PinValue } from "@declarations/pin";
import type { AbstractNode } from "@declarations/nodes";

export interface RefNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<string, AbstractNode<DataTypes, Nodes, Meta, any>>,
  Meta extends Field<DataTypes>,
  Name extends keyof Nodes,
  PinOut extends Pin<DataTypes, [PinOut], any>
> extends AbstractNode<DataTypes, Nodes, Meta, Name> {
  readonly type: NodeType.Ref;
  /** Пин возвращающий сущность, на которую ведёт реф-нода */
  readonly pinOut: PinOut;
  /**
   * Метод для резолва рефа, вызывается в момент подгрузки сущности из пина.
   * Берёт из метаданных информацию о местонахождении сущности, подгружает сущность и возвращает её.
  */
  readonly resolveRef: (args: {
    pinOut: PinOut;
    meta: FieldValue<Field<DataTypes>, DataTypes>;
  }) => Promise<PinValue<PinOut, DataTypes> | null>;
}
