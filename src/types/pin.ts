import type { Field, FieldValue } from "@declarations/field";

export type Pin<
  DataTypes extends Record<string, Field<DataTypes>>,
  Pins extends Pin<DataTypes, any, any>[],
  PinKey extends Pins[number]["key"]
> = {
  uuid: string;
  // Ключ пина, уникальный на все Pin'ы в рамках одной функции/ивента/рефа
  key: PinKey;
  // тип данных которые отдёт/забирает пин
  type: Field<DataTypes>;
  // Значение если к пину ничего не приконнекчено
  default?: FieldValue<Field<DataTypes>, DataTypes>;
};

export type ExecPin<
  ExecPins extends ExecPin<any, any>[],
  PinKey extends keyof ExecPins
> = {
  uuid: string;
  // Ключ пина, уникальный на все ExecPin'ы в рамках одной функции/ивента/рефа
  key: PinKey;
};

export type PinValue<
  TPin extends Pin<DataTypes, any, any>,
  DataTypes extends Record<string, Field<DataTypes>>
> = FieldValue<TPin["type"], DataTypes>;

export type PinArrayValue<
  Pins extends Pin<DataTypes, any, any>[],
  DataTypes extends Record<string, Field<DataTypes>>
> = {
  [Key in keyof Pins]: Pin<DataTypes, Pins, Pins[Key]["key"]> & {
    value: PinValue<Pins[Key], DataTypes>;
  };
};
