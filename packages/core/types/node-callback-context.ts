import type { PinInstanceType } from "../enums";
import type { Field } from "./field";
import type { Pin } from "./pin";
import type { PinInstance } from "./pin-instance";

export interface NodeCallbackActions<DataTypes extends Record<string, Field<DataTypes>>> {
  // Обновить настройки пина
  updatePin(name: string, args: { name?: string; pinType?: Pin<DataTypes>["type"] }): void;
  // Добавить пин
  addPin(name: string, type: PinInstanceType, pinType: Pin<DataTypes>["type"]): void;
  // Удалить пин
  removePin(name: string): void;
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
  getPinConfig(name: string): Pin<DataTypes> | undefined;
}

export interface NodeCallbackContext<
  DataTypes extends Record<string, Field<DataTypes>>,
  Config,
  Apis extends Record<string, any>,
> {
  config: Config;
  apis: Apis;
  actions: NodeCallbackActions<DataTypes>;
}
