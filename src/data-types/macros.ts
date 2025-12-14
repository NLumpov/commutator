import type { Field, FieldRecordValues } from "./field";
import type { NodeType } from "./node-type";

export type MacrosInstance<
  DataTypes extends Record<string, Field<DataTypes>>,
  Name extends string,
  HiddenStates extends Record<string, Field<DataTypes>>,
  SharedStates extends Record<string, Field<DataTypes>>,
  Consumers extends Record<string, Field<DataTypes>>
> = {
  readonly uuid: string;
  readonly type: NodeType.Macros;
  readonly name: Name;
  x: number;
  y: number;
  hiddenStates: FieldRecordValues<HiddenStates, DataTypes>;
  sharedStates: FieldRecordValues<SharedStates, DataTypes>;
  consumers: FieldRecordValues<Consumers, DataTypes>;
};

export type Macros<
  Api extends Record<string, Record<string, any>>,
  DataTypes extends Record<string, Field<DataTypes>>,
  Name extends string,
  HiddenStates extends Record<string, Field<DataTypes>>,
  SharedStates extends Record<string, Field<DataTypes>>,
  Consumers extends Record<string, Field<DataTypes>>
> = {
  hiddenStates: HiddenStates;
  sharedStates: SharedStates;
  consumers: Consumers;

  // Если хендлер скрыт, то к нему нельзя будет приконнектить никакие триггеры, и его можно будет
  // триггернуть только напрямую вызовом функции
  isHandlerHidden: boolean;
  // Функция-обработчик макроса, которая делает какие-то действия и может триггерить
  handler: (args: {
    api: Api;
    self: MacrosInstance<DataTypes, Name, HiddenStates, SharedStates, Consumers>;
  }) => Promise<void> | void;
};
