import type { Field } from "./field";
import type { CommonDataType } from "./common-data-type.enum";

export type ExcludeNonPrimitiveDataTypes<
  TDataTypes extends Record<string, Field<TDataTypes>>
> = Extract<
  {
    [Key in keyof TDataTypes]: TDataTypes[Key]["type"] extends Exclude<
      CommonDataType,
      | CommonDataType.Array
      | CommonDataType.Object
      | CommonDataType.StringEnum
      | CommonDataType.NumberEnum
    >
      ? Key
      : never;
  }[keyof TDataTypes],
  string
>;
