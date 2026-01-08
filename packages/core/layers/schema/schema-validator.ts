import {
  CommonDataType,
  type CommutatorConfig,
  CommutatorError,
  CommutatorValidator,
  type Field,
} from "../commutator";
import { PinInstanceType } from "./enums";
import type { AbstractNodeInstance, PinInstance, SchemaSnapshot, Wire } from "./types";

/**
 * Валидатор для SchemaSnapshot и операций со схемой.
 * КРИТИЧЕСКИ ВАЖНО: Все методы синхронные и выбрасывают CommutatorError при ошибках.
 * Невалидный снапшот НЕ ДОЛЖЕН быть пропущен.
 */
export class SchemaValidator {
  private constructor() {
    // Статический класс - нельзя создать экземпляр
  }

  /**
   * Проверяет, является ли строка валидным UUID или ULID.
   * ULID: 26 символов из алфавита "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
   * UUID: формат xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 символов) или без дефисов (32 символа)
   * Оптимизировано без использования регулярных выражений для максимальной производительности.
   */
  private static isValidUuidOrUlid(uuid: string): boolean {
    const length = uuid.length;

    // ULID: ровно 26 символов
    if (length === 26) {
      const ulidAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      const ulidAlphabetSet = new Set(ulidAlphabet);
      for (let i = 0; i < 26; i++) {
        const char = uuid[i];
        if (!char || !ulidAlphabetSet.has(char)) {
          return false;
        }
      }
      return true;
    }

    // UUID с дефисами: 36 символов
    if (length === 36) {
      // Проверяем позиции дефисов
      const char8 = uuid[8];
      const char13 = uuid[13];
      const char18 = uuid[18];
      const char23 = uuid[23];
      if (char8 !== "-" || char13 !== "-" || char18 !== "-" || char23 !== "-") {
        return false;
      }

      // Проверяем hex символы на всех позициях кроме дефисов
      const hexChars = "0123456789abcdefABCDEF";
      const hexSet = new Set(hexChars);
      for (let i = 0; i < 36; i++) {
        if (i !== 8 && i !== 13 && i !== 18 && i !== 23) {
          const char = uuid[i];
          if (!char || !hexSet.has(char)) {
            return false;
          }
        }
      }
      return true;
    }

    // UUID без дефисов: 32 символа
    if (length === 32) {
      const hexChars = "0123456789abcdefABCDEF";
      const hexSet = new Set(hexChars);
      for (let i = 0; i < 32; i++) {
        const char = uuid[i];
        if (!char || !hexSet.has(char)) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Полная валидация снапшота перед созданием схемы.
   * КРИТИЧЕСКИ ВАЖНО: Выполняется ДО создания экземпляра схемы.
   */
  static validateSnapshot(
    snapshot: SchemaSnapshot,
    config: CommutatorConfig<any, any, any, any, any, any>,
  ): void {
    // 1. Базовая структура - проверка на null/undefined
    if (!snapshot) {
      throw new CommutatorError("Snapshot is null or undefined");
    }

    if (!Array.isArray(snapshot.events)) {
      throw new CommutatorError("Snapshot.events must be an array");
    }

    if (!Array.isArray(snapshot.refs)) {
      throw new CommutatorError("Snapshot.refs must be an array");
    }

    if (!Array.isArray(snapshot.pureFunctions)) {
      throw new CommutatorError("Snapshot.pureFunctions must be an array");
    }

    if (!Array.isArray(snapshot.functions)) {
      throw new CommutatorError("Snapshot.functions must be an array");
    }

    if (!Array.isArray(snapshot.pinInstances)) {
      throw new CommutatorError("Snapshot.pinInstances must be an array");
    }

    if (!Array.isArray(snapshot.wires)) {
      throw new CommutatorError("Snapshot.wires must be an array");
    }

    // 2. Уникальность UUID нод
    const nodeUuids = new Set<string>();
    const allNodeInstances: AbstractNodeInstance<string>[] = [
      ...snapshot.events,
      ...snapshot.refs,
      ...snapshot.pureFunctions,
      ...snapshot.functions,
    ];

    for (const nodeInstance of allNodeInstances) {
      if (!nodeInstance || typeof nodeInstance !== "object") {
        throw new CommutatorError("Node instance is invalid");
      }

      if (!nodeInstance.uuid || typeof nodeInstance.uuid !== "string") {
        throw new CommutatorError("Node instance uuid is invalid");
      }

      if (!SchemaValidator.isValidUuidOrUlid(nodeInstance.uuid)) {
        throw new CommutatorError(
          `Node instance uuid "${nodeInstance.uuid}" is not a valid UUID or ULID`,
        );
      }

      if (nodeUuids.has(nodeInstance.uuid)) {
        throw new CommutatorError(`Duplicate node UUID: ${nodeInstance.uuid}`);
      }

      nodeUuids.add(nodeInstance.uuid);

      // Проверка существования nodeConfig
      const nodeConfig = config.getNodeConfigByName(nodeInstance.name);
      if (!nodeConfig) {
        throw new CommutatorError(
          `Node config for "${String(nodeInstance.name)}" of type "${nodeInstance.type}" not found`,
        );
      }

      // Валидация config ноды
      if (nodeConfig.config && nodeInstance.config !== undefined) {
        const validator = new CommutatorValidator(config.dataTypes);
        if (!validator.validateFieldValue(nodeConfig.config, nodeInstance.config)) {
          throw new CommutatorError(
            `Invalid config for node "${String(nodeInstance.name)}" of type "${nodeInstance.type}"`,
          );
        }
      }
    }

    // 3. Уникальность UUID пинов и проверка принадлежности нодам
    const pinUuids = new Set<string>();
    const pinInstancesMap = new Map<string, PinInstance>();

    for (const pinInstance of snapshot.pinInstances) {
      if (!pinInstance || typeof pinInstance !== "object") {
        throw new CommutatorError("Pin instance is invalid");
      }

      if (!pinInstance.uuid || typeof pinInstance.uuid !== "string") {
        throw new CommutatorError("Pin instance uuid is invalid");
      }

      if (!SchemaValidator.isValidUuidOrUlid(pinInstance.uuid)) {
        throw new CommutatorError(
          `Pin instance uuid "${pinInstance.uuid}" is not a valid UUID or ULID`,
        );
      }

      if (pinUuids.has(pinInstance.uuid)) {
        throw new CommutatorError(`Duplicate pin UUID: ${pinInstance.uuid}`);
      }

      pinUuids.add(pinInstance.uuid);
      pinInstancesMap.set(pinInstance.uuid, pinInstance);

      // Проверка принадлежности пина ноде
      if (!pinInstance.nodeUuid || typeof pinInstance.nodeUuid !== "string") {
        throw new CommutatorError(`Pin "${pinInstance.uuid}" has invalid nodeUuid`);
      }

      if (!SchemaValidator.isValidUuidOrUlid(pinInstance.nodeUuid)) {
        throw new CommutatorError(
          `Pin "${pinInstance.uuid}" has invalid nodeUuid format: "${pinInstance.nodeUuid}" is not a valid UUID or ULID`,
        );
      }

      if (!nodeUuids.has(pinInstance.nodeUuid)) {
        throw new CommutatorError(
          `Pin "${pinInstance.uuid}" belongs to non-existent node "${pinInstance.nodeUuid}"`,
        );
      }

      // Валидация pinType
      if (pinInstance.pinType !== null) {
        SchemaValidator.validatePinType(pinInstance.pinType, config.dataTypes);
      }

      // Валидация типа пина для data pins
      if (
        (pinInstance.type === PinInstanceType.Input ||
          pinInstance.type === PinInstanceType.Output) &&
        pinInstance.pinType === null
      ) {
        throw new CommutatorError(
          `Data pin "${pinInstance.uuid}" must have a valid pinType, got null`,
        );
      }

      if (
        (pinInstance.type === PinInstanceType.InputExec ||
          pinInstance.type === PinInstanceType.OutputExec) &&
        pinInstance.pinType !== null &&
        pinInstance.pinType !== CommonDataType.Any
      ) {
        throw new CommutatorError(
          `Exec pin "${pinInstance.uuid}" must have pinType Any or null, got ${String(pinInstance.pinType)}`,
        );
      }
    }

    // 4. Валидация проводов
    const wireSet = new Set<string>();

    for (const wire of snapshot.wires) {
      if (!wire || typeof wire !== "object") {
        throw new CommutatorError("Wire is invalid");
      }

      if (!wire.from || typeof wire.from !== "string") {
        throw new CommutatorError("Wire.from is invalid");
      }

      if (!SchemaValidator.isValidUuidOrUlid(wire.from)) {
        throw new CommutatorError(`Wire.from "${wire.from}" is not a valid UUID or ULID`);
      }

      if (!wire.to || typeof wire.to !== "string") {
        throw new CommutatorError("Wire.to is invalid");
      }

      if (!SchemaValidator.isValidUuidOrUlid(wire.to)) {
        throw new CommutatorError(`Wire.to "${wire.to}" is not a valid UUID or ULID`);
      }

      // Проверка уникальности проводов
      const wireKey = `${wire.from}:${wire.to}`;
      if (wireSet.has(wireKey)) {
        throw new CommutatorError(`Duplicate wire: ${wire.from} -> ${wire.to}`);
      }

      wireSet.add(wireKey);

      // Проверка существования пинов
      const fromPin = pinInstancesMap.get(wire.from);
      const toPin = pinInstancesMap.get(wire.to);

      if (!fromPin) {
        throw new CommutatorError(`Wire references non-existent pin: ${wire.from}`);
      }

      if (!toPin) {
        throw new CommutatorError(`Wire references non-existent pin: ${wire.to}`);
      }

      // Проверка self-loop
      if (wire.from === wire.to) {
        throw new CommutatorError(`Self-loop detected: pin ${wire.from} connected to itself`);
      }

      // Проверка типов пинов: from должен быть Output/OutputExec, to должен быть Input/InputExec
      if (fromPin.type !== PinInstanceType.Output && fromPin.type !== PinInstanceType.OutputExec) {
        throw new CommutatorError(
          `Wire.from pin "${wire.from}" must be Output or OutputExec, got ${fromPin.type}`,
        );
      }

      if (toPin.type !== PinInstanceType.Input && toPin.type !== PinInstanceType.InputExec) {
        throw new CommutatorError(
          `Wire.to pin "${wire.to}" must be Input or InputExec, got ${toPin.type}`,
        );
      }

      // Проверка совместимости типов: pinOut -> pinIn, execPinOut -> execPinIn
      if (fromPin.type === PinInstanceType.Output && toPin.type !== PinInstanceType.Input) {
        throw new CommutatorError(
          `Output pin "${wire.from}" can only connect to Input pin, got ${toPin.type}`,
        );
      }

      if (fromPin.type === PinInstanceType.OutputExec && toPin.type !== PinInstanceType.InputExec) {
        throw new CommutatorError(
          `OutputExec pin "${wire.from}" can only connect to InputExec pin, got ${toPin.type}`,
        );
      }

      // Проверка: нельзя соединить пин с пином из той же ноды
      if (fromPin.nodeUuid === toPin.nodeUuid) {
        throw new CommutatorError(
          `Cannot connect pin "${wire.from}" to pin "${wire.to}" from the same node "${fromPin.nodeUuid}"`,
        );
      }

      // Проверка совместимости типов данных для data pins
      if (fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input) {
        if (toPin.pinType !== null && toPin.pinType !== CommonDataType.Any) {
          if (fromPin.pinType !== toPin.pinType) {
            throw new CommutatorError(
              `Type mismatch: pin "${wire.from}" has type ${String(fromPin.pinType)}, but pin "${wire.to}" expects ${String(toPin.pinType)}`,
            );
          }
        }
      }
    }

    // 5. Проверка ограничений на провода
    // Оптимизировано: O(m + w) вместо O(m * w)
    // Строим индексы за один проход по проводам
    const outgoingWireCount = new Map<string, number>();
    const incomingWireCount = new Map<string, number>();

    for (const wire of snapshot.wires) {
      outgoingWireCount.set(wire.from, (outgoingWireCount.get(wire.from) || 0) + 1);
      incomingWireCount.set(wire.to, (incomingWireCount.get(wire.to) || 0) + 1);
    }

    // Проверяем ограничения для каждого пина
    for (const pinInstance of snapshot.pinInstances) {
      // execPinOut может иметь только один wire
      if (pinInstance.type === PinInstanceType.OutputExec) {
        const count = outgoingWireCount.get(pinInstance.uuid) || 0;
        if (count > 1) {
          throw new CommutatorError(
            `OutputExec pin "${pinInstance.uuid}" can have only one outgoing wire, found ${count}`,
          );
        }
      }

      // pinIn может иметь только один входящий wire
      if (pinInstance.type === PinInstanceType.Input) {
        const count = incomingWireCount.get(pinInstance.uuid) || 0;
        if (count > 1) {
          throw new CommutatorError(
            `Input pin "${pinInstance.uuid}" can have only one incoming wire, found ${count}`,
          );
        }
      }
    }

    // 6. Проверка циклических связей для всех проводов
    // Оптимизировано: O(n + w) вместо O(w^2 * n * p)
    // Строим индексы один раз и используем их для всех проверок
    const pinsByNode = new Map<string, Map<PinInstanceType, PinInstance[]>>();
    const wiresByPin = new Map<string, Wire[]>();

    // Строим индекс пинов по нодам: O(p)
    for (const pin of snapshot.pinInstances) {
      let nodePins = pinsByNode.get(pin.nodeUuid);
      if (!nodePins) {
        nodePins = new Map();
        pinsByNode.set(pin.nodeUuid, nodePins);
      }
      let pinsOfType = nodePins.get(pin.type);
      if (!pinsOfType) {
        pinsOfType = [];
        nodePins.set(pin.type, pinsOfType);
      }
      pinsOfType.push(pin);
    }

    // Строим индекс проводов по пинам: O(w)
    for (const wire of snapshot.wires) {
      let wires = wiresByPin.get(wire.from);
      if (!wires) {
        wires = [];
        wiresByPin.set(wire.from, wires);
      }
      wires.push(wire);
    }

    // Проверяем циклы для exec pins и data pins
    for (const wire of snapshot.wires) {
      const fromPin = pinInstancesMap.get(wire.from);
      const toPin = pinInstancesMap.get(wire.to);

      if (!fromPin || !toPin) {
        continue;
      }

      if (fromPin.type === PinInstanceType.OutputExec && toPin.type === PinInstanceType.InputExec) {
        if (
          SchemaValidator.wouldCreateCycleOptimized(
            toPin.nodeUuid,
            fromPin.nodeUuid,
            PinInstanceType.OutputExec,
            PinInstanceType.InputExec,
            pinsByNode,
            wiresByPin,
            pinInstancesMap,
          )
        ) {
          throw new CommutatorError(
            `Cyclic connection detected: exec pin "${wire.from}" -> "${wire.to}" creates a cycle`,
          );
        }
      }

      if (fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input) {
        if (
          SchemaValidator.wouldCreateCycleOptimized(
            toPin.nodeUuid,
            fromPin.nodeUuid,
            PinInstanceType.Output,
            PinInstanceType.Input,
            pinsByNode,
            wiresByPin,
            pinInstancesMap,
          )
        ) {
          throw new CommutatorError(
            `Cyclic connection detected: data pin "${wire.from}" -> "${wire.to}" creates a cycle`,
          );
        }
      }
    }
  }

  /**
   * Валидация операции wire.
   */
  static validateWire(
    fromPin: PinInstance<any>,
    toPin: PinInstance<any>,
    existingWires: Wire[],
    allPins: Map<string, PinInstance<any>>,
    allNodes: Map<string, AbstractNodeInstance<string>>,
    config: CommutatorConfig<any, any, any, any, any, any>,
  ): void {
    if (!fromPin || !toPin) {
      throw new CommutatorError("Pin not found");
    }

    // Проверка self-loop
    if (fromPin.uuid === toPin.uuid) {
      throw new CommutatorError("Self-loop");
    }

    // Определяем выходной и входной пины
    let outputPin: PinInstance<any>;
    let inputPin: PinInstance<any>;
    let outputPinUuid: string;
    let inputPinUuid: string;

    if (
      (fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input) ||
      (fromPin.type === PinInstanceType.OutputExec && toPin.type === PinInstanceType.InputExec)
    ) {
      outputPin = fromPin;
      inputPin = toPin;
      outputPinUuid = fromPin.uuid;
      inputPinUuid = toPin.uuid;
    } else if (
      (fromPin.type === PinInstanceType.Input && toPin.type === PinInstanceType.Output) ||
      (fromPin.type === PinInstanceType.InputExec && toPin.type === PinInstanceType.OutputExec)
    ) {
      outputPin = toPin;
      inputPin = fromPin;
      outputPinUuid = toPin.uuid;
      inputPinUuid = fromPin.uuid;
    } else {
      throw new CommutatorError("Invalid connection");
    }

    // Проверка типов: from должен быть Output/OutputExec, to должен быть Input/InputExec
    if (
      outputPin.type !== PinInstanceType.Output &&
      outputPin.type !== PinInstanceType.OutputExec
    ) {
      throw new CommutatorError(`Output pin must be Output or OutputExec, got ${outputPin.type}`);
    }

    if (inputPin.type !== PinInstanceType.Input && inputPin.type !== PinInstanceType.InputExec) {
      throw new CommutatorError(`Input pin must be Input or InputExec, got ${inputPin.type}`);
    }

    // Проверка совместимости типов: pinOut -> pinIn, execPinOut -> execPinIn
    if (outputPin.type === PinInstanceType.Output && inputPin.type !== PinInstanceType.Input) {
      throw new CommutatorError(`Output pin can only connect to Input pin, got ${inputPin.type}`);
    }

    if (
      outputPin.type === PinInstanceType.OutputExec &&
      inputPin.type !== PinInstanceType.InputExec
    ) {
      throw new CommutatorError(
        `OutputExec pin can only connect to InputExec pin, got ${inputPin.type}`,
      );
    }

    // Проверка: нельзя соединить пин с пином из той же ноды
    if (outputPin.nodeUuid === inputPin.nodeUuid) {
      throw new CommutatorError(
        `Cannot connect pin from node "${outputPin.nodeUuid}" to pin from the same node`,
      );
    }

    // Проверка существования нод
    const outputNode = allNodes.get(outputPin.nodeUuid);
    const inputNode = allNodes.get(inputPin.nodeUuid);

    if (!outputNode || !inputNode) {
      throw new CommutatorError("Node instance not found");
    }

    // Проверка существования nodeConfig
    const outputNodeConfig = config.getNodeConfigByName(outputNode.name);
    const inputNodeConfig = config.getNodeConfigByName(inputNode.name);

    if (!outputNodeConfig || !inputNodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Проверка типов для data pins
    if (outputPin.type === PinInstanceType.Output && inputPin.type === PinInstanceType.Input) {
      // Проверка совместимости типов
      if (inputPin.pinType !== null && inputPin.pinType !== CommonDataType.Any) {
        if (outputPin.pinType !== inputPin.pinType) {
          throw new CommutatorError("Type mismatch");
        }
      }

      // Для data pins (pinIn) может быть только один входной провод
      // Оптимизировано: O(w) вместо O(w) - используем some, но можно было бы использовать Set
      const isInputWireExists = existingWires.some((wire) => wire.to === inputPinUuid);
      if (isInputWireExists) {
        throw new CommutatorError("To wire already exists");
      }
    }

    // Для exec pins: execPinOut может иметь только одну исходящую связь
    if (outputPin.type === PinInstanceType.OutputExec) {
      // Оптимизировано: O(w) вместо O(w) - используем some, но можно было бы использовать Set
      const isOutputWireExists = existingWires.some((wire) => wire.from === outputPinUuid);
      if (isOutputWireExists) {
        throw new CommutatorError("ExecPinOut wire already exists");
      }
    }

    // Проверка циклических связей
    if (SchemaValidator.checkCyclicConnection(outputPin, inputPin, existingWires, allPins)) {
      throw new CommutatorError("Cyclic connection detected in pins");
    }
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь.
   */
  static checkCyclicConnection(
    outputPin: PinInstance<any>,
    inputPin: PinInstance<any>,
    existingWires: Wire[],
    allPins: Map<string, PinInstance<any>>,
  ): boolean {
    const outputNodeUuid = outputPin.nodeUuid;
    const inputNodeUuid = inputPin.nodeUuid;

    // Определяем типы пинов для проверки
    let outputPinType: PinInstanceType;
    let inputPinType: PinInstanceType;

    if (
      outputPin.type === PinInstanceType.OutputExec &&
      inputPin.type === PinInstanceType.InputExec
    ) {
      outputPinType = PinInstanceType.OutputExec;
      inputPinType = PinInstanceType.InputExec;
    } else if (
      outputPin.type === PinInstanceType.Output &&
      inputPin.type === PinInstanceType.Input
    ) {
      outputPinType = PinInstanceType.Output;
      inputPinType = PinInstanceType.Input;
    } else {
      // Не проверяем циклы для других комбинаций типов
      return false;
    }

    return SchemaValidator.wouldCreateCycle(
      inputNodeUuid,
      outputNodeUuid,
      outputPinType,
      inputPinType,
      existingWires,
      allPins,
    );
  }

  /**
   * Оптимизированная версия проверки циклических связей.
   * Сложность: O(n + w) вместо O(n * p * w)
   * Использует предварительно построенные индексы.
   */
  private static wouldCreateCycleOptimized(
    startNodeUuid: string,
    targetNodeUuid: string,
    outputPinType: PinInstanceType,
    inputPinType: PinInstanceType,
    pinsByNode: Map<string, Map<PinInstanceType, PinInstance[]>>,
    wiresByPin: Map<string, Wire[]>,
    pinInstancesMap: Map<string, PinInstance>,
  ): boolean {
    // Если стартовая нода совпадает с целевой, это цикл
    if (startNodeUuid === targetNodeUuid) {
      return true;
    }

    // Стек для хранения нод, которые нужно проверить
    const stack: string[] = [startNodeUuid];
    // Множество посещенных нод для избежания бесконечных циклов
    const visited = new Set<string>();

    // Пока есть ноды для проверки
    while (stack.length > 0) {
      const currentNodeUuid = stack.pop();

      if (!currentNodeUuid) {
        break;
      }

      // Если это целевая нода, цикл найден
      if (currentNodeUuid === targetNodeUuid) {
        return true;
      }

      // Если уже посещали эту ноду, пропускаем
      if (visited.has(currentNodeUuid)) {
        continue;
      }

      // Добавляем текущую ноду в посещенные
      visited.add(currentNodeUuid);

      // Получаем выходные пины текущей ноды из индекса: O(1)
      const nodePins = pinsByNode.get(currentNodeUuid);
      if (!nodePins) {
        continue;
      }

      const currentNodeOutputPins = nodePins.get(outputPinType) || [];

      // Для каждого выходного пина проверяем, куда он ведет
      for (const outputPin of currentNodeOutputPins) {
        // Получаем провода из индекса: O(1)
        const outgoingWires = wiresByPin.get(outputPin.uuid) || [];

        for (const wire of outgoingWires) {
          // Находим входной пин через индекс: O(1)
          const inputPin = pinInstancesMap.get(wire.to);
          if (!inputPin || inputPin.type !== inputPinType) {
            continue;
          }

          // Находим ноду, содержащую этот входной пин
          const nextNodeUuid = inputPin.nodeUuid;

          // Если мы достигли целевой ноды, это цикл
          if (nextNodeUuid === targetNodeUuid) {
            return true;
          }

          // Добавляем следующую ноду в стек для проверки
          if (!visited.has(nextNodeUuid)) {
            stack.push(nextNodeUuid);
          }
        }
      }
    }

    return false;
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь.
   * Проверяет, можно ли дойти от startNodeUuid до targetNodeUuid через пины указанных типов.
   * Используется для validateWire, где индексы еще не построены.
   */
  private static wouldCreateCycle(
    startNodeUuid: string,
    targetNodeUuid: string,
    outputPinType: PinInstanceType,
    inputPinType: PinInstanceType,
    existingWires: Wire[],
    allPins: Map<string, PinInstance<any>>,
  ): boolean {
    // Если стартовая нода совпадает с целевой, это цикл
    if (startNodeUuid === targetNodeUuid) {
      return true;
    }

    // Строим индексы на лету для оптимизации
    const pinsByNode = new Map<string, Map<PinInstanceType, PinInstance[]>>();
    const wiresByPin = new Map<string, Wire[]>();

    // Строим индекс пинов по нодам: O(p)
    for (const pin of allPins.values()) {
      let nodePins = pinsByNode.get(pin.nodeUuid);
      if (!nodePins) {
        nodePins = new Map();
        pinsByNode.set(pin.nodeUuid, nodePins);
      }
      let pinsOfType = nodePins.get(pin.type);
      if (!pinsOfType) {
        pinsOfType = [];
        nodePins.set(pin.type, pinsOfType);
      }
      pinsOfType.push(pin);
    }

    // Строим индекс проводов по пинам: O(w)
    for (const wire of existingWires) {
      let wires = wiresByPin.get(wire.from);
      if (!wires) {
        wires = [];
        wiresByPin.set(wire.from, wires);
      }
      wires.push(wire);
    }

    // Создаем индекс pinUuid -> PinInstance для быстрого поиска
    const pinByUuid = allPins;

    // Стек для хранения нод, которые нужно проверить
    const stack: string[] = [startNodeUuid];
    // Множество посещенных нод для избежания бесконечных циклов
    const visited = new Set<string>();

    // Пока есть ноды для проверки
    while (stack.length > 0) {
      const currentNodeUuid = stack.pop();

      if (!currentNodeUuid) {
        break;
      }

      // Если это целевая нода, цикл найден
      if (currentNodeUuid === targetNodeUuid) {
        return true;
      }

      // Если уже посещали эту ноду, пропускаем
      if (visited.has(currentNodeUuid)) {
        continue;
      }

      // Добавляем текущую ноду в посещенные
      visited.add(currentNodeUuid);

      // Получаем выходные пины текущей ноды из индекса: O(1)
      const nodePins = pinsByNode.get(currentNodeUuid);
      if (!nodePins) {
        continue;
      }

      const currentNodeOutputPins = nodePins.get(outputPinType) || [];

      // Для каждого выходного пина проверяем, куда он ведет
      for (const outputPin of currentNodeOutputPins) {
        // Получаем провода из индекса: O(1)
        const outgoingWires = wiresByPin.get(outputPin.uuid) || [];

        for (const wire of outgoingWires) {
          // Находим входной пин через индекс: O(1)
          const inputPin = pinByUuid.get(wire.to);
          if (!inputPin || inputPin.type !== inputPinType) {
            continue;
          }

          // Находим ноду, содержащую этот входной пин
          const nextNodeUuid = inputPin.nodeUuid;

          // Если мы достигли целевой ноды, это цикл
          if (nextNodeUuid === targetNodeUuid) {
            return true;
          }

          // Добавляем следующую ноду в стек для проверки
          if (!visited.has(nextNodeUuid)) {
            stack.push(nextNodeUuid);
          }
        }
      }
    }

    return false;
  }

  /**
   * Валидация добавления пина.
   */
  static validateAddPin(
    nodeUuid: string,
    pinName: string,
    pinType: PinInstanceType,
    pinDataType: any,
    nodeConfig: any,
    existingPins: Map<string, PinInstance<any>>,
  ): void {
    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Проверка canAddPin*
    if (
      (pinType === PinInstanceType.Input && !nodeConfig.canAddPinIn) ||
      (pinType === PinInstanceType.Output && !nodeConfig.canAddPinOut) ||
      (pinType === PinInstanceType.InputExec && !nodeConfig.canAddExecPinIn) ||
      (pinType === PinInstanceType.OutputExec && !nodeConfig.canAddExecPinOut)
    ) {
      throw new CommutatorError("Cannot add pin to node");
    }

    // Оптимизировано: O(p) где p - количество пинов конкретной ноды, вместо O(m) всех пинов
    // Проверка уникальности имени пина в ноде
    for (const pin of existingPins.values()) {
      if (pin.nodeUuid === nodeUuid && pin.name === pinName) {
        throw new CommutatorError(`Pin with name "${pinName}" already exists in node`);
      }
    }

    // Валидация pinType если передан
    if (pinDataType !== undefined) {
      SchemaValidator.validatePinType(pinDataType, nodeConfig);
    }
  }

  /**
   * Валидация удаления пина.
   */
  static validateRemovePin(
    pin: PinInstance<any>,
    nodeConfig: any,
    existingPins: Map<string, PinInstance<any>>,
  ): void {
    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Проверка canAddPin* (используется для удаления тоже)
    if (
      (pin.type === PinInstanceType.Input && !nodeConfig.canAddPinIn) ||
      (pin.type === PinInstanceType.Output && !nodeConfig.canAddPinOut) ||
      (pin.type === PinInstanceType.InputExec && !nodeConfig.canAddExecPinIn) ||
      (pin.type === PinInstanceType.OutputExec && !nodeConfig.canAddExecPinOut)
    ) {
      throw new CommutatorError("Cannot remove pin from node");
    }

    // Проверка: нельзя удалить последний пин данного типа
    const nodePins = [...existingPins.values()].filter(
      (p) => p.nodeUuid === pin.nodeUuid && p.type === pin.type,
    );

    if (nodePins.length <= 1) {
      throw new CommutatorError("Cannot remove last pin from node");
    }
  }

  /**
   * Валидация обновления конфигурации ноды.
   */
  static validateUpdateNodeConfig(
    nodeConfig: any,
    newConfig: unknown,
    validator: CommutatorValidator<any>,
  ): void {
    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    if (nodeConfig.config && newConfig !== undefined) {
      if (!validator.validateFieldValue(nodeConfig.config, newConfig)) {
        throw new CommutatorError(`Invalid config for node`);
      }
    }
  }

  /**
   * Проверка существования типа в DataTypes.
   */
  static validatePinType(pinType: any, dataTypes: Record<string, Field<any>>): void {
    const commonDataTypeValues = new Set<string>([
      CommonDataType.Any,
      CommonDataType.String,
      CommonDataType.Number,
      CommonDataType.Date,
      CommonDataType.Boolean,
      CommonDataType.Object,
      CommonDataType.Array,
      CommonDataType.StringEnum,
      CommonDataType.NumberEnum,
    ]);

    if (typeof pinType === "string" && !commonDataTypeValues.has(pinType)) {
      if (!(pinType in dataTypes)) {
        throw new CommutatorError(`Pin type "${String(pinType)}" does not exist in DataTypes`);
      }
    }
  }
}
