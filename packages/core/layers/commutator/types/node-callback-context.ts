import type { PinInstanceType } from "../../schema";
import type { PinInstance } from "../../schema/types/pin-instance";
import type { Field, FieldValue } from "./field";

export interface NodeCallbackActions<DataTypes extends Record<string, Field<DataTypes>>> {
  // Обновить настройки пина
  updatePin(pinUuid: string, args: { name?: string; dataType?: Field<DataTypes> }): void;
  // Добавить пин
  addPin(
    name: string,
    type: PinInstanceType.Input | PinInstanceType.Output,
    dataType: Field<DataTypes>,
  ): void;
  // Добавить exec pin
  addExecPin(name: string, type: PinInstanceType.InputExec | PinInstanceType.OutputExec): void;
  // Удалить пин
  removePin(pinUuid: string): void;
  // Сбросить пины до начального состояния
  resetPins(): void;
  // Получение информации о пине
  getPin(name: string): PinInstance<DataTypes> | undefined;
  // Получение всех пинов ноды
  getAllPins(): PinInstance<DataTypes>[];
  // Проверить связан ли пин с чем-то
  isWired(name: string): boolean;
  // Получить связанную ноду
  getWiredNode(name: string): PinInstance<DataTypes> | undefined;
  // Получить конфиг пина
  getPinConfig(name: string): Field<DataTypes> | undefined;
}

export interface NodeCallbackContext<
  DataTypes extends Record<string, Field<DataTypes>>,
  Config extends Field<DataTypes> | undefined,
  Apis extends Record<string, any>,
> {
  config: Config extends Field<DataTypes> ? FieldValue<Config, DataTypes> : undefined;
  apis: Apis;
  actions: NodeCallbackActions<DataTypes>;
}
