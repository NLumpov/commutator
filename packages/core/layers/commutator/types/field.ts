import type { CommonDataType } from "../enums";
import type { PrimitiveDataType } from "./primitive-data-type";

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
      type: keyof DataTypes;
    }
  | {
      type: PrimitiveDataType;
    }
  | {
      type: CommonDataType.Any;
    }
);

type FieldValueInternal<
  TField extends Field<DataTypes>,
  DataTypes extends Record<string, Field<DataTypes>>,
  Seen extends keyof DataTypes = never,
> = TField["type"] extends CommonDataType
  ? TField extends { type: CommonDataType.Any }
    ? unknown
    : TField extends { type: CommonDataType.Object; properties: infer Properties }
      ? Properties extends Record<string, Field<DataTypes>>
        ? { [K in keyof Properties]: FieldValueInternal<Properties[K], DataTypes, Seen> }
        : never
      : TField extends { type: CommonDataType.Array; itemType: infer ItemType }
        ? ItemType extends Field<DataTypes>
          ? FieldValueInternal<ItemType, DataTypes, Seen>[]
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
    ? TField["type"] extends Seen
      ? any
      : FieldValueInternal<DataTypes[TField["type"]], DataTypes, Seen | TField["type"]>
    : never;

export type FieldValue<
  TField extends Field<DataTypes>,
  DataTypes extends Record<string, Field<DataTypes>>,
> = FieldValueInternal<TField, DataTypes>;

export type FieldRecordValues<
  RecordFields extends Record<string, Field<DataTypes>>,
  DataTypes extends Record<string, Field<DataTypes>>,
> = { [Key in keyof RecordFields]: FieldValue<RecordFields[Key], DataTypes> };
