import type { Field, FieldValue } from "../data-types";
import type { Nodeable, NodeableType } from "../data-types/nodeable";

export type StaticGetterNode<
  Type extends string,
  DataTypes extends Record<string, Field<DataTypes>>
> = Nodeable & {
  readonly type: Type;
  readonly nodeType: NodeableType.StaticGetter;
  value: FieldValue<DataTypes[Type], DataTypes> | null;
};
