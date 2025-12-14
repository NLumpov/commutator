import type { Field, FieldRecordValues, FieldValue } from "./field";
import type { NodeType } from "./node-type";

export type StaticGetterNodeInstance<
  DataTypes extends Record<string, Field<DataTypes>>,
  Name extends keyof DataTypes,
  Value extends Field<DataTypes>
> = {
  readonly uuid: string;
  readonly name: Name;
  readonly type: NodeType.StaticGetter;
  x: number;
  y: number;
  value: FieldValue<Value, DataTypes>;
};

export type RemoteGetterNodeInstance<
  DataTypes extends Record<string, Field<DataTypes>>,
  Name extends keyof DataTypes,
  Keys extends Record<string, Field<DataTypes>>,
  Value extends Field<DataTypes>
> = {
  readonly uuid: string;
  readonly name: Name;
  readonly type: NodeType.RemoteGetter;
  x: number;
  y: number;
  keys: FieldRecordValues<Keys, DataTypes>;
  value: FieldValue<Value, DataTypes> | null;
};

export type RemoteGetterNode<
  Api extends Record<string, Record<string, any>>,
  DataTypes extends Record<string, Field<DataTypes>>,
  Keys extends Record<string, Field<DataTypes>>,
  Name extends string,
  Value extends Field<DataTypes>
> = {
  keys: Keys;
  value: Value;

  get: (args: {
    self: RemoteGetterNodeInstance<DataTypes, Name, Keys, Value>;
    api: Api;
  }) =>
    | Promise<FieldValue<Value, DataTypes> | null>
    | FieldValue<Value, DataTypes>
    | null;
  set: (args: {
    self: Omit<RemoteGetterNodeInstance<DataTypes, Name, Keys, Value>, "value">;
    api: Api;
    value: FieldRecordValues<Keys, DataTypes>;
  }) => Promise<void> | void;
};
