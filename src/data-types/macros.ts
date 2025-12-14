import type { Field, FieldValue } from "./field";
import { NodeType } from "./node-type";

// TODO Вынести значения за рамки графа, чтобы можно было делать инстансы графа
// TODO Сделать UUID для hiddenStates, sharedStates и т.д. в графе, значения привязываются к UUID
// TODO Сделать выгрузку графа в JSON и обратно

export const enum FieldType {
  HiddenState = "HiddenState",
  SharedState = "SharedState",
  Consumer = "Consumer",
}

type MacrosFieldsValues<
  Fields extends Record<string, MacrosField<DataTypes>>,
  DataTypes extends Record<string, Field<DataTypes>>
> = { [Key in keyof Fields]: FieldValue<Fields[Key]["field"], DataTypes> };

export type MacrosField<DataTypes extends Record<string, Field<DataTypes>>, FieldData extends Field<DataTypes>> = {
  uuid: string;
  type: FieldType;
  field: FieldData;
};

export type MacrosInstance<
  DataTypes extends Record<string, Field<DataTypes>>,
  Name extends string,
  Fields extends Record<string, MacrosField<DataTypes, Field<DataTypes>>>
> = {
  readonly uuid: string;
  readonly type: NodeType.Macros;
  readonly name: Name;
  x: number;
  y: number;
  values: MacrosFieldsValues<Fields, DataTypes>;
};

export type Macros<
  Api extends Record<string, Record<string, any>>,
  DataTypes extends Record<string, Field<DataTypes>>,
  Name extends string,
  Fields extends Record<string, MacrosField<DataTypes, Field<DataTypes>>>
> = {
  readonly uuid: string;
  readonly type: NodeType.Macros;
  readonly fields: Fields;

  // Если хендлер скрыт, то к нему нельзя будет приконнектить никакие триггеры, и его можно будет
  // триггернуть только напрямую вызовом функции триггера
  readonly isHandlerHidden: boolean;
  // Вызывается когда связанный триггер триггерит макрос
  readonly handler: (args: {
    api: Api;
    self: MacrosInstance<DataTypes, Name, Fields>;
  }) => Promise<void> | void;
};
