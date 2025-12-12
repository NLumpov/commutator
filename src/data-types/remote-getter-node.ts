import type { Field, FieldRecordValues, FieldValue } from "./field";

export type RemoteGetterNodeInstance<
  DataTypes extends Record<string, Field<DataTypes>>,
  Keys extends Record<string, Field<DataTypes>>,
  Value extends Field<DataTypes>
> = {
  readonly uuid: string;
  x: number;
  y: number;
  keys: FieldRecordValues<Keys, DataTypes>;
  value: FieldValue<Value, DataTypes> | null;
};

export type RemoteGetterNode<
  Api extends Record<string, Record<string, any>>,
  DataTypes extends Record<string, Field<DataTypes>>,
  Keys extends Record<string, Field<DataTypes>>,
  Value extends Field<DataTypes>
> = {
  keys: Keys;
  value: Value;

  get: (args: {
    self: RemoteGetterNodeInstance<DataTypes, Keys, Value>;
    api: Api;
  }) => Promise<FieldValue<Value, DataTypes>>;
  set: (keys: FieldRecordValues<Keys, DataTypes>) => void;
};
