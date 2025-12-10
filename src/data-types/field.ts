import { CommonDataType } from "./data-types";

export type Field<DataTypes extends Record<string, Field<DataTypes>>> = {
  name?: string;
} & (
  | {
      type: CommonDataType.Object;
      properties: Record<string, Field<DataTypes>>;
    }
  | {
      type: CommonDataType.Array;
      itemType: Field<DataTypes>;
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
      type: CommonDataType | string;
    }
);

export type FieldValue<
  TField extends Field<DataTypes>,
  DataTypes extends Record<string, Field<DataTypes>>
> = TField extends {
  type: CommonDataType.Object;
  properties: infer Props;
}
  ? Props extends Record<string, Field<DataTypes>>
    ? { [K in keyof Props]: FieldValue<Props[K], DataTypes> }
    : never
  : TField extends { type: CommonDataType.Array; itemType: infer ItemType }
  ? ItemType extends Field<DataTypes>
    ? FieldValue<ItemType, DataTypes>[]
    : never
  : TField extends { type: CommonDataType.StringEnum; values: infer Values }
  ? Values extends readonly string[]
    ? Values[number]
    : never
  : TField extends { type: CommonDataType.NumberEnum; values: infer Values }
  ? Values extends readonly number[]
    ? Values[number]
    : never
  : DataTypes[TField["type"]]["type"] extends CommonDataType.String
  ? string
  : DataTypes[TField["type"]]["type"] extends CommonDataType.Number
  ? number
  : DataTypes[TField["type"]]["type"] extends CommonDataType.Boolean
  ? boolean
  : DataTypes[TField["type"]]["type"] extends CommonDataType.Date
  ? Date
  : never;
