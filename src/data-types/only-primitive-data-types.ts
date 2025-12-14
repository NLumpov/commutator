import type { Field, FieldValue } from "./field";

export type OnlyPrimitiveDataTypes<
  DataTypes extends Record<string, Field<DataTypes>>
> = {
  [K in keyof DataTypes]: FieldValue<DataTypes[K], DataTypes> extends
    | string
    | number
    | boolean
    | null
    ? DataTypes[K]
    : never;
};
