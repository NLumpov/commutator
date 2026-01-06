import type { CommonDataType } from "../enums";

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
      type:
        | keyof DataTypes
        | Exclude<
            CommonDataType,
            | CommonDataType.Object
            | CommonDataType.Array
            | CommonDataType.StringEnum
            | CommonDataType.NumberEnum
          >;
    }
);

export type FieldValue<
  TField extends Field<DataTypes>,
  DataTypes extends Record<string, Field<DataTypes>>,
> = TField["type"] extends CommonDataType
  ? TField extends { type: CommonDataType.Object; properties: infer Properties }
    ? Properties extends Record<string, Field<DataTypes>>
      ? { [K in keyof Properties]: FieldValue<Properties[K], DataTypes> }
      : never
    : TField extends { type: CommonDataType.Array; itemType: infer ItemType }
      ? ItemType extends Field<DataTypes>
        ? FieldValue<ItemType, DataTypes>[]
        : never
      : TField extends { type: CommonDataType.StringEnum; values: infer Values }
        ? Values extends readonly string[]
          ? Values[number] | null
          : never
        : TField extends { type: CommonDataType.NumberEnum; values: infer Values }
          ? Values extends readonly number[]
            ? Values[number] | null
            : never
          : TField["type"] extends CommonDataType.String
            ? string | null
            : TField["type"] extends CommonDataType.Number
              ? number | null
              : TField["type"] extends CommonDataType.Boolean
                ? boolean | null
                : TField["type"] extends CommonDataType.Date
                  ? number | null
                  : never
  : TField["type"] extends keyof DataTypes
    ? FieldValue<DataTypes[TField["type"]], DataTypes>
    : never;

export type FieldRecordValues<
  RecordFields extends Record<string, Field<DataTypes>>,
  DataTypes extends Record<string, Field<DataTypes>>,
> = { [Key in keyof RecordFields]: FieldValue<RecordFields[Key], DataTypes> };
