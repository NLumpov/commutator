import type { PinInstance } from "./types";

export class PinsRegistry<DataTypes extends Record<string, any> = any> {
  private pinsByUuid: Map<string, PinInstance<DataTypes>> = new Map();
  private pinsByNodeUuid: Map<string, Map<string, PinInstance<DataTypes>>> = new Map();
  private pinsByName: Map<string, Map<string, PinInstance<DataTypes>>> = new Map();

  /**
   * Создает уникальный ключ для пина (name:type)
   */
  private getPinKey(name: string, type: string): string {
    return `${name}:${type}`;
  }

  constructor(pins: PinInstance<DataTypes>[] = []) {
    for (const pin of pins) {
      this.addPinInternal(pin);
    }
  }

  /**
   * Добавляет пин в реестр и обновляет все индексы
   */
  addPin(pin: PinInstance<DataTypes>): void {
    if (this.pinsByUuid.has(pin.uuid)) {
      throw new Error(`Pin with uuid "${pin.uuid}" already exists`);
    }
    this.addPinInternal(pin);
  }

  /**
   * Внутренний метод для добавления пина без проверки на существование
   */
  private addPinInternal(pin: PinInstance<DataTypes>): void {
    // Индекс по UUID
    this.pinsByUuid.set(pin.uuid, pin);

    // Индекс по nodeUuid -> pinKey (name:type)
    let nodePins = this.pinsByNodeUuid.get(pin.nodeUuid);
    if (!nodePins) {
      nodePins = new Map();
      this.pinsByNodeUuid.set(pin.nodeUuid, nodePins);
    }
    const pinKey = this.getPinKey(pin.name, pin.type);
    nodePins.set(pinKey, pin);

    // Индекс по pinName -> nodeUuid
    let namePins = this.pinsByName.get(pin.name);
    if (!namePins) {
      namePins = new Map();
      this.pinsByName.set(pin.name, namePins);
    }
    namePins.set(pin.nodeUuid, pin);
  }

  /**
   * Удаляет пин из реестра и обновляет все индексы
   */
  removePin(uuid: string): void {
    const pin = this.pinsByUuid.get(uuid);
    if (!pin) {
      return;
    }

    // Удаляем из индекса по UUID
    this.pinsByUuid.delete(uuid);

    // Удаляем из индекса по nodeUuid
    const nodePins = this.pinsByNodeUuid.get(pin.nodeUuid);
    if (nodePins) {
      const pinKey = this.getPinKey(pin.name, pin.type);
      nodePins.delete(pinKey);
      if (nodePins.size === 0) {
        this.pinsByNodeUuid.delete(pin.nodeUuid);
      }
    }

    // Удаляем из индекса по pinName
    const namePins = this.pinsByName.get(pin.name);
    if (namePins) {
      namePins.delete(pin.nodeUuid);
      if (namePins.size === 0) {
        this.pinsByName.delete(pin.name);
      }
    }
  }

  /**
   * Обновляет имя пина и переиндексирует его
   */
  updatePinName(uuid: string, newName: string): void {
    const pin = this.pinsByUuid.get(uuid);
    if (!pin) {
      throw new Error(`Pin with uuid "${uuid}" not found`);
    }

    const oldName = pin.name;

    // Удаляем из старых индексов
    const nodePins = this.pinsByNodeUuid.get(pin.nodeUuid);
    if (nodePins) {
      const oldPinKey = this.getPinKey(oldName, pin.type);
      nodePins.delete(oldPinKey);
    }

    const oldNamePins = this.pinsByName.get(oldName);
    if (oldNamePins) {
      oldNamePins.delete(pin.nodeUuid);
      if (oldNamePins.size === 0) {
        this.pinsByName.delete(oldName);
      }
    }

    // Обновляем имя
    pin.name = newName;

    // Добавляем в новые индексы
    if (nodePins) {
      const newPinKey = this.getPinKey(newName, pin.type);
      nodePins.set(newPinKey, pin);
    }

    let newNamePins = this.pinsByName.get(newName);
    if (!newNamePins) {
      newNamePins = new Map();
      this.pinsByName.set(newName, newNamePins);
    }
    newNamePins.set(pin.nodeUuid, pin);
  }

  /**
   * Получает все пины ноды по её UUID
   */
  getPinsByNodeUuid(nodeUuid: string): PinInstance<DataTypes>[] {
    const nodePins = this.pinsByNodeUuid.get(nodeUuid);
    if (!nodePins) {
      return [];
    }
    return Array.from(nodePins.values());
  }

  /**
   * Получает все пины с указанным именем
   */
  getPinsByName(name: string): PinInstance<DataTypes>[] {
    const namePins = this.pinsByName.get(name);
    if (!namePins) {
      return [];
    }
    return Array.from(namePins.values());
  }

  /**
   * Получает пин по имени и UUID ноды
   * ВАЖНО: Если у ноды есть несколько пинов с одинаковым именем, но разными типами,
   * возвращается первый найденный. Для точного поиска используйте getPinByNameTypeAndNodeUuid.
   */
  getPinByNameAndNodeUuid(name: string, nodeUuid: string): PinInstance<DataTypes> | undefined {
    const nodePins = this.pinsByNodeUuid.get(nodeUuid);
    if (!nodePins) {
      return undefined;
    }
    // Ищем первый пин с таким именем (может быть несколько с разными типами)
    for (const pin of nodePins.values()) {
      if (pin.name === name) {
        return pin;
      }
    }
    return undefined;
  }

  /**
   * Получает пин по имени, типу и UUID ноды
   */
  getPinByNameTypeAndNodeUuid(
    name: string,
    type: string,
    nodeUuid: string,
  ): PinInstance<DataTypes> | undefined {
    const nodePins = this.pinsByNodeUuid.get(nodeUuid);
    if (!nodePins) {
      return undefined;
    }
    const pinKey = this.getPinKey(name, type);
    return nodePins.get(pinKey);
  }

  /**
   * Получает пин по UUID
   */
  getPinByUuid(uuid: string): PinInstance<DataTypes> | undefined {
    return this.pinsByUuid.get(uuid);
  }

  /**
   * Проверяет существование пина по UUID
   */
  hasPin(uuid: string): boolean {
    return this.pinsByUuid.has(uuid);
  }

  /**
   * Возвращает все пины
   */
  getAllPins(): PinInstance<DataTypes>[] {
    return Array.from(this.pinsByUuid.values());
  }

  /**
   * Возвращает Map всех пинов (uuid -> pin)
   */
  getAllPinsMap(): Map<string, PinInstance<DataTypes>> {
    return new Map(this.pinsByUuid);
  }

  /**
   * Очищает реестр
   */
  clear(): void {
    this.pinsByUuid.clear();
    this.pinsByNodeUuid.clear();
    this.pinsByName.clear();
  }
}
