import { CommutatorError, type CommutatorValidator, type Field } from "../commutator";
import { PinInstanceType } from "./enums";
import type { NodesRegistry } from "./nodes-registry";
import type { PinsRegistry } from "./pins-registry";
import { TopologicalIndex } from "./topological-index";
import type { PinInstance, Wire } from "./types";

export class WiresRegistry<DataTypes extends Record<string, Field<DataTypes>>> {
  private wiresByFromPin: Map<string, Set<Wire>> = new Map();
  private wiresByToPin: Map<string, Set<Wire>> = new Map();
  private wiresSet: Set<string> = new Set();

  // Топологические индексы для data и exec проводов
  private dataTopologicalIndex: TopologicalIndex<DataTypes>;
  private execTopologicalIndex: TopologicalIndex<DataTypes>;

  // Сохраняем ссылку на pinsRegistry для методов
  private pinsRegistry: PinsRegistry<DataTypes>;

  constructor(
    wires: Wire[] = [],
    pinsRegistry: PinsRegistry<DataTypes>,
    nodesRegistry: NodesRegistry<DataTypes>,
    validator: CommutatorValidator<DataTypes>,
  ) {
    this.pinsRegistry = pinsRegistry;

    // Инициализируем топологические индексы (пустые, без прохода по нодам)
    this.dataTopologicalIndex = new TopologicalIndex();
    this.execTopologicalIndex = new TopologicalIndex();

    // Используем существующий индекс pinUuid -> nodeUuid
    const pinToNode = pinsRegistry.getPinsToNodeIndex();

    // ОДИН проход: валидация + добавление проводов + построение индекса параллельно
    for (const wire of wires) {
      if (!wire || typeof wire !== "object") {
        throw new CommutatorError("Wire is invalid");
      }

      if (!wire.from || typeof wire.from !== "string") {
        throw new CommutatorError("Wire.from is invalid");
      }

      if (!wire.to || typeof wire.to !== "string") {
        throw new CommutatorError("Wire.to is invalid");
      }

      if (this.wiresSet.has(this.getWireKey(wire.from, wire.to))) {
        throw new CommutatorError(`Duplicate wire: ${wire.from} -> ${wire.to}`);
      }

      const fromPin = pinsRegistry.getPinByUuid(wire.from);
      const toPin = pinsRegistry.getPinByUuid(wire.to);

      if (!fromPin || !toPin) {
        throw new CommutatorError(`Pin not found`);
      }

      validator.validateWire(fromPin, toPin, this, nodesRegistry);

      // Добавляем провод в реестр
      this.addWireInternal(wire);

      // Параллельно добавляем в топологический индекс (используем pinToNode индекс)
      const fromNodeUuid = pinToNode.get(wire.from);
      const toNodeUuid = pinToNode.get(wire.to);

      if (fromNodeUuid && toNodeUuid) {
        const isDataWire =
          fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input;
        const isExecWire =
          fromPin.type === PinInstanceType.OutputExec && toPin.type === PinInstanceType.InputExec;

        if (isDataWire) {
          this.dataTopologicalIndex.addWire(fromNodeUuid, toNodeUuid);
        } else if (isExecWire) {
          this.execTopologicalIndex.addWire(fromNodeUuid, toNodeUuid);
        }
      }
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
  addWire(wire: Wire, pinsRegistry: PinsRegistry<DataTypes>): void {
    const key = this.getWireKey(wire.from, wire.to);

    // Идемпотентно останавливаем выполнение добавления связи если она уже есть
    if (this.wiresSet.has(key)) {
      return;
    }

    const fromPin = pinsRegistry.getPinByUuid(wire.from);
    const toPin = pinsRegistry.getPinByUuid(wire.to);

    if (!fromPin || !toPin) {
      throw new CommutatorError(`Pin not found`);
    }

    this.addWireInternal(wire);

    // Обновляем топологический индекс
    const pinToNode = pinsRegistry.getPinsToNodeIndex();
    const fromNodeUuid = pinToNode.get(wire.from);
    const toNodeUuid = pinToNode.get(wire.to);

    if (fromNodeUuid && toNodeUuid) {
      const isDataWire =
        fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input;
      const isExecWire =
        fromPin.type === PinInstanceType.OutputExec && toPin.type === PinInstanceType.InputExec;

      if (isDataWire) {
        this.dataTopologicalIndex.addWire(fromNodeUuid, toNodeUuid);
      } else if (isExecWire) {
        this.execTopologicalIndex.addWire(fromNodeUuid, toNodeUuid);
      }
    }
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
  removeWire(from: string, to: string, pinsRegistry: PinsRegistry<DataTypes>): void {
    const key = this.getWireKey(from, to);
    if (!this.wiresSet.has(key)) {
      return;
    }

    // Both indexes store the same Wire object. Deleting a fresh { from, to }
    // would leave traversal edges behind after updating the topology index.
    const wire = this.getWiresByFromPin(from).find((candidate) => candidate.to === to);
    if (!wire) return;

    const fromPin = pinsRegistry.getPinByUuid(from);
    const toPin = pinsRegistry.getPinByUuid(to);

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

    // Обновляем топологический индекс
    if (fromPin && toPin) {
      const pinToNode = pinsRegistry.getPinsToNodeIndex();
      const fromNodeUuid = pinToNode.get(from);
      const toNodeUuid = pinToNode.get(to);

      if (fromNodeUuid && toNodeUuid) {
        const isDataWire =
          fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input;
        const isExecWire =
          fromPin.type === PinInstanceType.OutputExec && toPin.type === PinInstanceType.InputExec;

        if (isDataWire) {
          this.dataTopologicalIndex.removeWire(fromNodeUuid, toNodeUuid);
        } else if (isExecWire) {
          this.execTopologicalIndex.removeWire(fromNodeUuid, toNodeUuid);
        }
      }
    }
  }

  /**
   * Удаляет все провода, связанные с указанным пином (и входящие, и выходящие)
   */
  removeWiresByPin(pinUuid: string, pinsRegistry: PinsRegistry<DataTypes>): void {
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
      this.removeWire(wire.from, wire.to, pinsRegistry);
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
   * Проверка наличия циклов через топологический индекс
   */
  hasCycle(wireType: "exec" | "data"): boolean {
    if (wireType === "data") {
      return this.dataTopologicalIndex.hasCycle();
    }
    return this.execTopologicalIndex.hasCycle();
  }

  /**
   * Проверка, создаст ли новый провод цикл (инкрементально)
   */
  willCreateCycle(fromPin: PinInstance<DataTypes>, toPin: PinInstance<DataTypes>): boolean {
    const pinToNode = this.pinsRegistry.getPinsToNodeIndex();
    const fromNodeUuid = pinToNode.get(fromPin.uuid);
    const toNodeUuid = pinToNode.get(toPin.uuid);

    if (!fromNodeUuid || !toNodeUuid) {
      return false;
    }

    const isDataWire =
      fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input;
    const isExecWire =
      fromPin.type === PinInstanceType.OutputExec && toPin.type === PinInstanceType.InputExec;

    if (isDataWire) {
      return this.dataTopologicalIndex.willCreateCycleFast(
        fromNodeUuid,
        toNodeUuid,
        this.pinsRegistry,
        this,
        "data",
      );
    }

    if (isExecWire) {
      return this.execTopologicalIndex.willCreateCycleFast(
        fromNodeUuid,
        toNodeUuid,
        this.pinsRegistry,
        this,
        "exec",
      );
    }

    return false;
  }

  /**
   * Очищает реестр
   */
  clear(): void {
    this.wiresByFromPin.clear();
    this.wiresByToPin.clear();
    this.wiresSet.clear();
    this.dataTopologicalIndex.clear();
    this.execTopologicalIndex.clear();
  }
}
