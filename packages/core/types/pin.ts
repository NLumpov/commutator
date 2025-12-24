import type { Field, FieldValue } from "@declarations/field";
import type { CommonDataType } from "@enums/common-data-type";

export type Pin<DataTypes extends Record<string, Field<DataTypes>>> = {
  // тип данных которые отдёт/забирает пин
  type:
    | keyof DataTypes
    | Exclude<
        CommonDataType,
        | CommonDataType.Object
        | CommonDataType.Array
        | CommonDataType.StringEnum
        | CommonDataType.NumberEnum
      >;
  // Значение если к пину ничего не приконнекчено
  default?: FieldValue<Field<DataTypes>, DataTypes>;
};

export type ExecPin = {}

export type PinValue<
  TPin extends Pin<DataTypes>,
  DataTypes extends Record<string, Field<DataTypes>>
> = FieldValue<TPin, DataTypes>;

export type PinRecordValue<
  Pins extends Record<string, Pin<DataTypes>>,
  DataTypes extends Record<string, Field<DataTypes>>
> = {
  [Key in keyof Pins]: PinValue<Pins[Key], DataTypes>;
};
