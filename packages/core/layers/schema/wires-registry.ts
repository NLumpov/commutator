import type { Wire } from "./types";

export class WiresRegistry {
  private wiresByFromPin: Map<string, Set<Wire>> = new Map();
  private wiresByToPin: Map<string, Set<Wire>> = new Map();
  private wiresSet: Set<string> = new Set();

  constructor(wires: Wire[] = []) {
    for (const wire of wires) {
      this.addWireInternal(wire);
    }
  }

  /**
   * Создает уникальный ключ для провода
   */
  private getWireKey(from: string, to: string): string {
    return `${from}:${to}`;
  }

  /**
   * Добавляет провод в реестр и обновляет все индексы
   */
  addWire(wire: Wire): void {
    const key = this.getWireKey(wire.from, wire.to);
    if (this.wiresSet.has(key)) {
      throw new Error(`Wire from "${wire.from}" to "${wire.to}" already exists`);
    }
    this.addWireInternal(wire);
  }

  /**
   * Внутренний метод для добавления провода без проверки на существование
   */
  private addWireInternal(wire: Wire): void {
    const key = this.getWireKey(wire.from, wire.to);

    // Индекс для проверки существования
    this.wiresSet.add(key);

    // Индекс по выходному пину (from)
    let fromWires = this.wiresByFromPin.get(wire.from);
    if (!fromWires) {
      fromWires = new Set();
      this.wiresByFromPin.set(wire.from, fromWires);
    }
    fromWires.add(wire);

    // Индекс по входному пину (to)
    let toWires = this.wiresByToPin.get(wire.to);
    if (!toWires) {
      toWires = new Set();
      this.wiresByToPin.set(wire.to, toWires);
    }
    toWires.add(wire);
  }

  /**
   * Удаляет провод из реестра и обновляет все индексы
   */
  removeWire(from: string, to: string): void {
    const key = this.getWireKey(from, to);
    if (!this.wiresSet.has(key)) {
      return;
    }

    const wire: Wire = { from, to };

    // Удаляем из индекса существования
    this.wiresSet.delete(key);

    // Удаляем из индекса по выходному пину
    const fromWires = this.wiresByFromPin.get(from);
    if (fromWires) {
      fromWires.delete(wire);
      if (fromWires.size === 0) {
        this.wiresByFromPin.delete(from);
      }
    }

    // Удаляем из индекса по входному пину
    const toWires = this.wiresByToPin.get(to);
    if (toWires) {
      toWires.delete(wire);
      if (toWires.size === 0) {
        this.wiresByToPin.delete(to);
      }
    }
  }

  /**
   * Удаляет все провода, связанные с указанным пином (и входящие, и выходящие)
   */
  removeWiresByPin(pinUuid: string): void {
    // Собираем все провода, связанные с пином
    const wiresToRemove: Wire[] = [];

    // Провода, выходящие из пина
    const fromWires = this.wiresByFromPin.get(pinUuid);
    if (fromWires) {
      wiresToRemove.push(...fromWires);
    }

    // Провода, входящие в пин
    const toWires = this.wiresByToPin.get(pinUuid);
    if (toWires) {
      wiresToRemove.push(...toWires);
    }

    // Удаляем все найденные провода
    for (const wire of wiresToRemove) {
      this.removeWire(wire.from, wire.to);
    }
  }

  /**
   * Получает все провода, выходящие из указанного пина
   */
  getWiresByFromPin(fromPinUuid: string): Wire[] {
    const fromWires = this.wiresByFromPin.get(fromPinUuid);
    if (!fromWires) {
      return [];
    }
    return Array.from(fromWires);
  }

  /**
   * Получает все провода, входящие в указанный пин
   */
  getWiresByToPin(toPinUuid: string): Wire[] {
    const toWires = this.wiresByToPin.get(toPinUuid);
    if (!toWires) {
      return [];
    }
    return Array.from(toWires);
  }

  /**
   * Получает все провода, связанные с указанным пином (и входящие, и выходящие)
   */
  getWiresByPin(pinUuid: string): Wire[] {
    const wires: Wire[] = [];

    // Провода, выходящие из пина
    const fromWires = this.wiresByFromPin.get(pinUuid);
    if (fromWires) {
      wires.push(...fromWires);
    }

    // Провода, входящие в пин
    const toWires = this.wiresByToPin.get(pinUuid);
    if (toWires) {
      wires.push(...toWires);
    }

    return wires;
  }

  /**
   * Проверяет существование провода
   */
  hasWire(from: string, to: string): boolean {
    const key = this.getWireKey(from, to);
    return this.wiresSet.has(key);
  }

  /**
   * Проверяет, связан ли указанный пин с какими-либо проводами
   */
  isPinWired(pinUuid: string): boolean {
    const fromWires = this.wiresByFromPin.get(pinUuid);
    if (fromWires && fromWires.size > 0) {
      return true;
    }
    const toWires = this.wiresByToPin.get(pinUuid);
    if (toWires && toWires.size > 0) {
      return true;
    }
    return false;
  }

  /**
   * Проверяет, есть ли провод, входящий в указанный пин
   * O(1) - использует индекс
   */
  hasIncomingWire(toPinUuid: string): boolean {
    const toWires = this.wiresByToPin.get(toPinUuid);
    return toWires !== undefined && toWires.size > 0;
  }

  /**
   * Проверяет, есть ли провод, выходящий из указанного пина
   * O(1) - использует индекс
   */
  hasOutgoingWire(fromPinUuid: string): boolean {
    const fromWires = this.wiresByFromPin.get(fromPinUuid);
    return fromWires !== undefined && fromWires.size > 0;
  }

  /**
   * Возвращает все провода
   */
  getAllWires(): Wire[] {
    const wires: Wire[] = [];
    const seen = new Set<string>();

    // Собираем все уникальные провода из обоих индексов
    for (const wireSet of this.wiresByFromPin.values()) {
      for (const wire of wireSet) {
        const key = this.getWireKey(wire.from, wire.to);
        if (!seen.has(key)) {
          seen.add(key);
          wires.push(wire);
        }
      }
    }

    return wires;
  }

  /**
   * Очищает реестр
   */
  clear(): void {
    this.wiresByFromPin.clear();
    this.wiresByToPin.clear();
    this.wiresSet.clear();
  }
}
