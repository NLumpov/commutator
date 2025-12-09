import { CommonDataType } from "./data-types";

export type Field<
  CustomDataTypes extends Record<string, string>,
  AllDataTypes extends keyof CustomDataTypes | CommonDataType =
    | keyof CustomDataTypes
    | CommonDataType
> = { name?: string } & (
  | {
      type: CommonDataType.Object;
      properties: Record<string, Field<CustomDataTypes, AllDataTypes>>;
    }
  | {
      type: CommonDataType.Array;
      itemType: Field<CustomDataTypes, AllDataTypes>;
    }
  | {
      type: CommonDataType.StringEnum;
      values: string[];
    }
  | {
      type: CommonDataType.NumberEnum;
      values: number[];
    }
  | {
      type: CommonDataType;
    }
);

export type FieldValue<TField extends Field<any, any>> = TField extends {
  type: CommonDataType.Object;
  properties: infer Props;
}
  ? Props extends Record<string, Field<any, any>>
    ? {
        [K in keyof Props]: FieldValue<Props[K]>;
      }
    : never
  : TField extends { type: CommonDataType.Array; itemType: infer ItemType }
  ? ItemType extends Field<any, any>
    ? FieldValue<ItemType>[]
    : never
  : TField extends { type: CommonDataType.StringEnum; values: infer Values }
  ? Values extends readonly string[]
    ? Values[number]
    : never
  : TField extends { type: CommonDataType.NumberEnum; values: infer Values }
  ? Values extends readonly number[]
    ? Values[number]
    : never
  : TField extends { type: CommonDataType.String }
  ? string
  : TField extends { type: CommonDataType.Number }
  ? number
  : TField extends { type: CommonDataType.Boolean }
  ? boolean
  : TField extends { type: CommonDataType.Date }
  ? Date
  : never;
