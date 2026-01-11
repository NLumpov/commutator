import { PinInstanceType } from "../schema/enums";
import type { AbstractNodeInstance, PinInstance, SchemaSnapshot, Wire } from "../schema/types";
import type { WiresRegistry } from "../schema/wires-registry";
import type { CommutatorConfig } from "./commutator-config";
import { CommutatorError } from "./commutator-error";
import { CommonDataType, PrimitiveDataTypes } from "./enums";
import type { Field, PrimitiveDataType } from "./types";

export class CommutatorValidator<const DataTypes extends Record<string, Field<DataTypes>> = {}> {
  // Константы для валидации UUID/ULID
  private static readonly ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  private static readonly ULID_ALPHABET_SET = new Set(CommutatorValidator.ULID_ALPHABET.split(""));
  private static readonly HEX_CHARS = "0123456789abcdefABCDEF";
  private static readonly HEX_SET = new Set(CommutatorValidator.HEX_CHARS.split(""));
  private static readonly COMMON_DATA_TYPE_VALUES = new Set<string>([
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

  constructor(private readonly dataTypes: DataTypes) {}

  public hasDataType(name: PropertyKey): name is keyof DataTypes | PrimitiveDataType {
    return name in this.dataTypes || PrimitiveDataTypes.includes(name as PrimitiveDataType);
  }

  public validateFieldValue(field: Field<DataTypes>, value: unknown): boolean {
    const stack: { field: Field<DataTypes>; value: unknown }[] = [{ field, value }];

    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) {
        break;
      }
      const { field: currentField, value: currentValue } = item;

      // null допустим для всех типов
      if (currentValue === null) {
        continue;
      }

      // Проверка для Object
      if (currentField.type === CommonDataType.Object) {
        if (
          typeof currentValue !== "object" ||
          currentValue === null ||
          Array.isArray(currentValue)
        ) {
          return false;
        }
        if (!("properties" in currentField)) {
          return false;
        }
        const obj = currentValue as Record<string, unknown>;
        for (const [key, propertyField] of Object.entries(currentField.properties)) {
          if (!(key in obj)) {
            return false;
          }
          stack.push({ field: propertyField, value: obj[key] });
        }
        continue;
      }

      // Проверка для Array
      if (currentField.type === CommonDataType.Array) {
        if (!Array.isArray(currentValue)) {
          return false;
        }
        if (!("itemType" in currentField)) {
          return false;
        }
        for (const item of currentValue) {
          stack.push({ field: currentField.itemType, value: item });
        }
        continue;
      }

      // Проверка для StringEnum
      if (currentField.type === CommonDataType.StringEnum) {
        if (!("values" in currentField)) {
          return false;
        }
        const stringEnumField = currentField as {
          type: CommonDataType.StringEnum;
          values: string[];
        };
        if (typeof currentValue !== "string" || !stringEnumField.values.includes(currentValue)) {
          return false;
        }
        continue;
      }

      // Проверка для NumberEnum
      if (currentField.type === CommonDataType.NumberEnum) {
        if (!("values" in currentField)) {
          return false;
        }
        const numberEnumField = currentField as {
          type: CommonDataType.NumberEnum;
          values: number[];
        };
        if (typeof currentValue !== "number" || !numberEnumField.values.includes(currentValue)) {
          return false;
        }
        continue;
      }

      // Проверка для простых типов
      if (currentField.type === CommonDataType.String) {
        if (typeof currentValue !== "string") {
          return false;
        }
        continue;
      }

      if (
        currentField.type === CommonDataType.Number ||
        currentField.type === CommonDataType.Date
      ) {
        if (typeof currentValue !== "number") {
          return false;
        }
        continue;
      }

      if (currentField.type === CommonDataType.Boolean) {
        if (typeof currentValue !== "boolean") {
          return false;
        }
        continue;
      }

      if (currentField.type === CommonDataType.Any) {
        continue;
      }

      // Проверка для кастомных типов из DataTypes
      if (typeof currentField.type === "string" && currentField.type in this.dataTypes) {
        const customField = this.dataTypes[currentField.type];
        if (!customField) {
          return false;
        }
        stack.push({ field: customField, value: currentValue });
        continue;
      }

      return false;
    }

    return true;
  }

  /**
   * Глубокая проверка совместимости двух Field.
   * Проверяет структуру Object, Array, StringEnum, NumberEnum и пользовательские типы.
   */
  private areFieldsCompatible(
    outputField: Field<any> | null,
    inputField: Field<any> | null,
    visited: Set<string> = new Set(),
  ): boolean {
    // Если оба поля null, они совместимы
    if (outputField === null && inputField === null) {
      return true;
    }

    // Если одно из полей null, они несовместимы (уже проверено выше, но для типобезопасности)
    if (outputField === null || inputField === null) {
      return false;
    }

    // Если оба поля имеют тип Any, они совместимы
    if (outputField.type === CommonDataType.Any && inputField.type === CommonDataType.Any) {
      return true;
    }

    // Если input принимает Any, всегда совместимо
    if (inputField.type === CommonDataType.Any) {
      return true;
    }

    // Если output это Any, он несовместим с другими типами
    if (outputField.type === CommonDataType.Any) {
      return false;
    }

    // Если типы не совпадают на верхнем уровне, несовместимы
    if (outputField.type !== inputField.type) {
      return false;
    }

    // Проверка для Object
    if (outputField.type === CommonDataType.Object && inputField.type === CommonDataType.Object) {
      const outputProps = "properties" in outputField ? outputField.properties : undefined;
      const inputProps = "properties" in inputField ? inputField.properties : undefined;

      if (!outputProps || !inputProps) {
        return false;
      }

      // Все свойства input должны быть в output и быть совместимыми
      for (const [key, inputProp] of Object.entries(inputProps)) {
        if (!(key in outputProps)) {
          return false;
        }
        const outputProp = outputProps[key];
        if (!outputProp) {
          return false;
        }
        if (!this.areFieldsCompatible(outputProp, inputProp, visited)) {
          return false;
        }
      }

      return true;
    }

    // Проверка для Array
    if (outputField.type === CommonDataType.Array && inputField.type === CommonDataType.Array) {
      const outputItemType = "itemType" in outputField ? outputField.itemType : undefined;
      const inputItemType = "itemType" in inputField ? inputField.itemType : undefined;

      if (!outputItemType || !inputItemType) {
        return false;
      }

      return this.areFieldsCompatible(outputItemType, inputItemType, visited);
    }

    // Проверка для StringEnum
    if (
      outputField.type === CommonDataType.StringEnum &&
      inputField.type === CommonDataType.StringEnum
    ) {
      const outputValues = "values" in outputField ? outputField.values : undefined;
      const inputValues = "values" in inputField ? inputField.values : undefined;

      if (!outputValues || !inputValues) {
        return false;
      }

      // Все значения input должны быть в output
      const outputValuesSet = new Set(outputValues as string[]);
      return (inputValues as string[]).every((value) => outputValuesSet.has(value));
    }

    // Проверка для NumberEnum
    if (
      outputField.type === CommonDataType.NumberEnum &&
      inputField.type === CommonDataType.NumberEnum
    ) {
      const outputValues = "values" in outputField ? outputField.values : undefined;
      const inputValues = "values" in inputField ? inputField.values : undefined;

      if (!outputValues || !inputValues) {
        return false;
      }

      // Все значения input должны быть в output
      const outputValuesSet = new Set(outputValues as number[]);
      return (inputValues as number[]).every((value) => outputValuesSet.has(value));
    }

    // Проверка для пользовательских типов из DataTypes
    if (
      typeof outputField.type === "string" &&
      typeof inputField.type === "string" &&
      outputField.type in this.dataTypes &&
      inputField.type in this.dataTypes
    ) {
      // Предотвращаем циклические ссылки
      const typeKey = `${outputField.type}:${inputField.type}`;
      if (visited.has(typeKey)) {
        return true; // Уже проверяли, считаем совместимым
      }

      visited.add(typeKey);

      const outputCustomField = this.dataTypes[outputField.type];
      const inputCustomField = this.dataTypes[inputField.type];

      if (!outputCustomField || !inputCustomField) {
        return false;
      }

      return this.areFieldsCompatible(outputCustomField, inputCustomField, visited);
    }

    // Для примитивных типов (String, Number, Boolean, Date) простое сравнение уже выполнено
    return true;
  }

  /**
   * Проверяет совместимость типов пинов с глубокой проверкой структуры.
   */
  public arePinDataTypesCompatible(
    outputPin: PinInstance<any>,
    inputPin: PinInstance<any>,
  ): boolean {
    // Если оба пина undefined, несовместимы
    if (outputPin.dataType === undefined && inputPin.dataType === undefined) {
      return false;
    }

    // Если оба пина null, совместимы
    if (outputPin.dataType === null && inputPin.dataType === null) {
      return true;
    }

    // Если input принимает Any или null, всегда совместимо
    if (inputPin.dataType?.type === CommonDataType.Any || inputPin.dataType === null) {
      return true;
    }

    // Если output это Any, он несовместим с другими типами (кроме Any и null)
    if (outputPin.dataType?.type === CommonDataType.Any) {
      return false;
    }

    // Если типы не совпадают на верхнем уровне, несовместимы
    if (outputPin.dataType?.type !== inputPin.dataType?.type) {
      return false;
    }

    // Выполняем глубокую проверку (включая проверку на Any)
    return this.areFieldsCompatible(outputPin.dataType, inputPin.dataType);
  }

  /**
   * Проверяет, является ли строка валидным UUID или ULID.
   * ULID: 26 символов из алфавита "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
   * UUID: формат xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 символов) или без дефисов (32 символа)
   * Оптимизировано без использования регулярных выражений для максимальной производительности.
   */
  private isValidUuidOrUlid(uuid: string): boolean {
    const length = uuid.length;

    // ULID: ровно 26 символов
    if (length === 26) {
      for (let i = 0; i < 26; i++) {
        const char = uuid[i];
        if (!char || !CommutatorValidator.ULID_ALPHABET_SET.has(char)) {
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
      for (let i = 0; i < 36; i++) {
        if (i !== 8 && i !== 13 && i !== 18 && i !== 23) {
          const char = uuid[i];
          if (!char || !CommutatorValidator.HEX_SET.has(char)) {
            return false;
          }
        }
      }
      return true;
    }

    // UUID без дефисов: 32 символа
    if (length === 32) {
      for (let i = 0; i < 32; i++) {
        const char = uuid[i];
        if (!char || !CommutatorValidator.HEX_SET.has(char)) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Проверка существования типа в DataTypes.
   */
  public validatePinDataType(dataType: any): void {
    // dataType is a Field object with a type property, not a string
    // We need to check dataType.type instead of dataType
    const typeValue = dataType?.type;

    // Check if typeValue is a string (custom type) and not in common types
    if (
      typeof typeValue === "string" &&
      !CommutatorValidator.COMMON_DATA_TYPE_VALUES.has(typeValue)
    ) {
      if (!(typeValue in this.dataTypes)) {
        throw new CommutatorError(`Pin type "${String(typeValue)}" does not exist in DataTypes`);
      }
    }
  }

  /**
   * Полная валидация снапшота перед созданием схемы.
   * КРИТИЧЕСКИ ВАЖНО: Выполняется ДО создания экземпляра схемы.
   */
  public validateSnapshot(
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
    // Оптимизировано: создаем Map сразу вместо массива для последующего использования
    const nodeUuids = new Set<string>();
    const allNodesMap = new Map<string, AbstractNodeInstance<string>>();
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

      if (!this.isValidUuidOrUlid(nodeInstance.uuid)) {
        throw new CommutatorError(
          `Node instance uuid "${nodeInstance.uuid}" is not a valid UUID or ULID`,
        );
      }

      if (nodeUuids.has(nodeInstance.uuid)) {
        throw new CommutatorError(`Duplicate node UUID: ${nodeInstance.uuid}`);
      }

      nodeUuids.add(nodeInstance.uuid);
      // Добавляем в Map для последующего O(1) доступа
      allNodesMap.set(nodeInstance.uuid, nodeInstance);

      // Проверка существования nodeConfig
      const nodeConfig = config.getNodeConfigByName(nodeInstance.name);
      if (!nodeConfig) {
        throw new CommutatorError(
          `Node config for "${String(nodeInstance.name)}" of type "${nodeInstance.type}" not found`,
        );
      }

      // Валидация config ноды
      if (nodeConfig.config && nodeInstance.config !== undefined) {
        if (!this.validateFieldValue(nodeConfig.config, nodeInstance.config)) {
          throw new CommutatorError(
            `Invalid config for node "${String(nodeInstance.name)}" of type "${nodeInstance.type}"`,
          );
        }
      }
    }

    // 3. Уникальность UUID пинов и проверка принадлежности нодам
    // Одновременно строим индексы для последующего использования
    const pinUuids = new Set<string>();
    const pinInstancesMap = new Map<string, PinInstance>();
    const pinsByNode = new Map<string, Map<PinInstanceType, PinInstance[]>>();

    for (const pinInstance of snapshot.pinInstances) {
      if (!pinInstance || typeof pinInstance !== "object") {
        throw new CommutatorError("Pin instance is invalid");
      }

      if (!pinInstance.uuid || typeof pinInstance.uuid !== "string") {
        throw new CommutatorError("Pin instance uuid is invalid");
      }

      if (!this.isValidUuidOrUlid(pinInstance.uuid)) {
        throw new CommutatorError(
          `Pin instance uuid "${pinInstance.uuid}" is not a valid UUID or ULID`,
        );
      }

      if (pinUuids.has(pinInstance.uuid)) {
        throw new CommutatorError(`Duplicate pin UUID: ${pinInstance.uuid}`);
      }

      pinUuids.add(pinInstance.uuid);
      pinInstancesMap.set(pinInstance.uuid, pinInstance);

      // Строим индекс пинов по нодам одновременно с валидацией
      let nodePins = pinsByNode.get(pinInstance.nodeUuid);
      if (!nodePins) {
        nodePins = new Map();
        pinsByNode.set(pinInstance.nodeUuid, nodePins);
      }
      let pinsOfType = nodePins.get(pinInstance.type);
      if (!pinsOfType) {
        pinsOfType = [];
        nodePins.set(pinInstance.type, pinsOfType);
      }
      pinsOfType.push(pinInstance);

      // Проверка принадлежности пина ноде
      if (!pinInstance.nodeUuid || typeof pinInstance.nodeUuid !== "string") {
        throw new CommutatorError(`Pin "${pinInstance.uuid}" has invalid nodeUuid`);
      }

      if (!this.isValidUuidOrUlid(pinInstance.nodeUuid)) {
        throw new CommutatorError(
          `Pin "${pinInstance.uuid}" has invalid nodeUuid format: "${pinInstance.nodeUuid}" is not a valid UUID or ULID`,
        );
      }

      if (!nodeUuids.has(pinInstance.nodeUuid)) {
        throw new CommutatorError(
          `Pin "${pinInstance.uuid}" belongs to non-existent node "${pinInstance.nodeUuid}"`,
        );
      }

      // Валидация dataType
      if (pinInstance.dataType !== null) {
        this.validatePinDataType(pinInstance.dataType);
      }

      // Валидация типа пина для data pins
      if (
        (pinInstance.type === PinInstanceType.Input ||
          pinInstance.type === PinInstanceType.Output) &&
        pinInstance.dataType === null
      ) {
        throw new CommutatorError(
          `Data pin "${pinInstance.uuid}" must have a valid dataType, got null`,
        );
      }

      if (
        (pinInstance.type === PinInstanceType.InputExec ||
          pinInstance.type === PinInstanceType.OutputExec) &&
        pinInstance.dataType !== null &&
        pinInstance.dataType.type !== CommonDataType.Any
      ) {
        throw new CommutatorError(
          `Exec pin "${pinInstance.uuid}" must have dataType Any or null, got ${String(pinInstance.dataType.type)}`,
        );
      }
    }

    // 4. Валидация проводов и построение индексов
    // Объединены разделы 4 и 5: валидация проводов и сбор данных для проверки ограничений
    const wireSet = new Set<string>();
    const wiresByPin = new Map<string, Wire[]>();
    const outgoingWireCount = new Map<string, number>();
    const incomingWireCount = new Map<string, number>();
    // Кеш для результатов проверки совместимости типов
    const typeCompatibilityCache = new Map<string, boolean>();

    for (const wire of snapshot.wires) {
      if (!wire || typeof wire !== "object") {
        throw new CommutatorError("Wire is invalid");
      }

      if (!wire.from || typeof wire.from !== "string") {
        throw new CommutatorError("Wire.from is invalid");
      }

      if (!this.isValidUuidOrUlid(wire.from)) {
        throw new CommutatorError(`Wire.from "${wire.from}" is not a valid UUID or ULID`);
      }

      if (!wire.to || typeof wire.to !== "string") {
        throw new CommutatorError("Wire.to is invalid");
      }

      if (!this.isValidUuidOrUlid(wire.to)) {
        throw new CommutatorError(`Wire.to "${wire.to}" is not a valid UUID or ULID`);
      }

      // Проверка уникальности проводов
      const wireKey = `${wire.from}:${wire.to}`;
      if (wireSet.has(wireKey)) {
        throw new CommutatorError(`Duplicate wire: ${wire.from} -> ${wire.to}`);
      }

      wireSet.add(wireKey);

      // Строим индекс проводов по пинам одновременно с валидацией
      let wires = wiresByPin.get(wire.from);
      if (!wires) {
        wires = [];
        wiresByPin.set(wire.from, wires);
      }
      wires.push(wire);

      // Собираем счетчики для проверки ограничений
      outgoingWireCount.set(wire.from, (outgoingWireCount.get(wire.from) || 0) + 1);
      incomingWireCount.set(wire.to, (incomingWireCount.get(wire.to) || 0) + 1);

      // Проверка существования пинов
      const fromPin = pinInstancesMap.get(wire.from);
      const toPin = pinInstancesMap.get(wire.to);

      if (!fromPin) {
        throw new CommutatorError(`Wire references non-existent pin: ${wire.from}`);
      }

      if (!toPin) {
        throw new CommutatorError(`Wire references non-existent pin: ${wire.to}`);
      }

      // Проверка типов пинов
      this.validateWirePinTypes(fromPin, toPin);

      // Проверка ограничений на провода (self-loop и одна нода)
      if (wire.from === wire.to) {
        throw new CommutatorError(`Self-loop detected: pin ${wire.from} connected to itself`);
      }

      if (fromPin.nodeUuid === toPin.nodeUuid) {
        throw new CommutatorError(
          `Cannot connect pin "${wire.from}" to pin "${wire.to}" from the same node "${fromPin.nodeUuid}"`,
        );
      }

      // Проверка совместимости типов данных для data pins с кешированием
      if (fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input) {
        // Используем кеш для быстрой проверки совместимости типов
        const cacheKey = `${String(fromPin.dataType?.type ?? "null")}:${String(toPin.dataType?.type ?? "null")}`;
        let isCompatible: boolean;

        const cache = typeCompatibilityCache.get(cacheKey);

        if (cache) {
          isCompatible = cache;
        } else {
          isCompatible = this.arePinDataTypesCompatible(fromPin, toPin);
          typeCompatibilityCache.set(cacheKey, isCompatible);
        }

        // Если типы несовместимы, вызываем полную валидацию для получения детального сообщения об ошибке
        // validateWireDataTypes также проверяет существование нод и конфигов
        if (!isCompatible) {
          this.validateWireDataTypes(fromPin, toPin, allNodesMap, config);
        }
      }
    }

    // 5. Проверка ограничений на провода (количество проводов)
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
    // Оптимизировано: O(n + w) вместо O(w * (n + w))
    // Используем detectAllCycles для поиска всех циклов за один проход
    // Разделяем проверку для exec pins и data pins на два отдельных графа
    const execCycles = this.detectAllCycles(
      pinsByNode,
      wiresByPin,
      pinInstancesMap,
      PinInstanceType.OutputExec,
      PinInstanceType.InputExec,
    );

    if (execCycles.length > 0) {
      const cycleNodes = execCycles[0]?.join(" -> ") || "unknown";
      throw new CommutatorError(`Cyclic connection detected in exec pins: ${cycleNodes}`);
    }

    const dataCycles = this.detectAllCycles(
      pinsByNode,
      wiresByPin,
      pinInstancesMap,
      PinInstanceType.Output,
      PinInstanceType.Input,
    );

    if (dataCycles.length > 0) {
      const cycleNodes = dataCycles[0]?.join(" -> ") || "unknown";
      throw new CommutatorError(`Cyclic connection detected in data pins: ${cycleNodes}`);
    }
  }

  /**
   * Проверяет типы пинов для провода
   */
  private validateWirePinTypes(outputPin: PinInstance<any>, inputPin: PinInstance<any>): void {
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
  }

  /**
   * Проверяет совместимость типов данных для data pins
   * Оптимизировано: использует Map для O(1) поиска нод вместо O(n) find()
   */
  private validateWireDataTypes(
    outputPin: PinInstance<any>,
    inputPin: PinInstance<any>,
    allNodes: Map<string, AbstractNodeInstance<string>>,
    config: CommutatorConfig<any, any, any, any, any, any>,
  ): void {
    if (outputPin.type !== PinInstanceType.Output || inputPin.type !== PinInstanceType.Input) {
      return;
    }

    // Проверяем совместимость, если:
    // 1. output имеет тип Any (должен быть несовместим) - всегда проверяем
    // 2. input имеет конкретный тип (не null и не Any) - проверяем
    if (
      outputPin.dataType?.type === CommonDataType.Any ||
      (inputPin.dataType !== null && inputPin.dataType?.type !== CommonDataType.Any)
    ) {
      // O(1) вместо O(n) - используем Map.get() вместо find()
      const fromNode = allNodes.get(outputPin.nodeUuid);
      const toNode = allNodes.get(inputPin.nodeUuid);

      if (!fromNode || !toNode) {
        throw new CommutatorError("Node instance not found");
      }

      const fromNodeConfig = config.getNodeConfigByName(fromNode.name);
      const toNodeConfig = config.getNodeConfigByName(toNode.name);

      if (!fromNodeConfig || !toNodeConfig) {
        throw new CommutatorError("Node config not found");
      }

      // Глубокая проверка совместимости типов
      if (!this.arePinDataTypesCompatible(outputPin, inputPin)) {
        throw new CommutatorError(
          `Type mismatch: pin "${outputPin.uuid}" has type ${String(outputPin.dataType?.type)}, but pin "${inputPin.uuid}" expects ${String(inputPin.dataType?.type)}`,
        );
      }
    }
  }

  /**
   * Проверяет ограничения на провода (self-loop, одна нода, ограничения на количество проводов)
   * Оптимизировано: использует индексы WiresRegistry для O(1) проверок вместо O(w)
   */
  private validateWireConstraints(
    outputPin: PinInstance<any>,
    inputPin: PinInstance<any>,
    outputPinUuid: string,
    inputPinUuid: string,
    wiresRegistry: WiresRegistry,
  ): void {
    // Проверка self-loop
    if (outputPinUuid === inputPinUuid) {
      throw new CommutatorError("Self-loop");
    }

    // Проверка: нельзя соединить пин с пином из той же ноды
    if (outputPin.nodeUuid === inputPin.nodeUuid) {
      throw new CommutatorError(
        `Cannot connect pin from node "${outputPin.nodeUuid}" to pin from the same node`,
      );
    }

    // Для data pins (pinIn) может быть только один входной провод
    // O(1) вместо O(w) - используем индекс
    if (outputPin.type === PinInstanceType.Output && inputPin.type === PinInstanceType.Input) {
      if (wiresRegistry.hasIncomingWire(inputPinUuid)) {
        throw new CommutatorError("To wire already exists");
      }
    }

    // Для exec pins: execPinOut может иметь только одну исходящую связь
    // O(1) вместо O(w) - используем индекс
    if (outputPin.type === PinInstanceType.OutputExec) {
      if (wiresRegistry.hasOutgoingWire(outputPinUuid)) {
        throw new CommutatorError("ExecPinOut wire already exists");
      }
    }
  }

  /**
   * Валидация операции wire.
   * Оптимизировано: принимает WiresRegistry для O(1) проверок вместо O(w) массивов
   * и pre-built pinsByNodeAndType индекс для O(1) доступа вместо O(p) перестроения
   */
  public validateWire(
    fromPin: PinInstance<any>,
    toPin: PinInstance<any>,
    wiresRegistry: WiresRegistry,
    allPins: Map<string, PinInstance<any>>,
    allNodes: Map<string, AbstractNodeInstance<string>>,
    config: CommutatorConfig<any, any, any, any, any, any>,
    pinsByNodeAndType?: Map<string, Map<PinInstanceType, PinInstance<any>[]>>,
  ): void {
    if (!fromPin || !toPin) {
      throw new CommutatorError("Pin not found");
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

    // Проверка типов пинов
    this.validateWirePinTypes(outputPin, inputPin);

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

    // Проверка ограничений на провода
    // O(1) вместо O(w) - используем индексы WiresRegistry
    this.validateWireConstraints(outputPin, inputPin, outputPinUuid, inputPinUuid, wiresRegistry);

    // Проверка типов данных для data pins
    // O(1) вместо O(n) - используем Map напрямую
    this.validateWireDataTypes(outputPin, inputPin, allNodes, config);

    // Проверка циклических связей
    // Используем индексы из WiresRegistry и pre-built pinsByNodeAndType для оптимизации
    if (
      this.checkCyclicConnection(outputPin, inputPin, wiresRegistry, allPins, pinsByNodeAndType)
    ) {
      throw new CommutatorError("Cyclic connection detected in pins");
    }
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь.
   * Оптимизировано: использует индексы из WiresRegistry и pre-built pinsByNodeAndType для O(1) доступа
   */
  public checkCyclicConnection(
    outputPin: PinInstance<any>,
    inputPin: PinInstance<any>,
    wiresRegistry: WiresRegistry,
    allPins: Map<string, PinInstance<any>>,
    pinsByNodeAndType?: Map<string, Map<PinInstanceType, PinInstance<any>[]>>,
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

    // Если pre-built индекс передан, используем оптимизированный путь
    if (pinsByNodeAndType) {
      return this.wouldCreateCycle(
        inputNodeUuid,
        outputNodeUuid,
        outputPinType,
        inputPinType,
        pinsByNodeAndType, // pre-built индекс
        undefined, // wiresByPin
        allPins, // pinInstancesMap
        wiresRegistry,
        undefined, // allPins - не нужен, т.к. pinsByNode передан
      );
    }

    // Legacy путь: используем wiresRegistry + allPins
    return this.wouldCreateCycle(
      inputNodeUuid,
      outputNodeUuid,
      outputPinType,
      inputPinType,
      undefined, // pinsByNode - будет построен из allPins
      undefined, // wiresByPin
      undefined, // pinInstancesMap
      wiresRegistry,
      allPins, // allPins - используется для построения pinsByNode
    );
  }

  /**
   * Обнаруживает все циклы в графе за один проход используя DFS.
   * Разделяет проверку для exec pins и data pins на два отдельных графа.
   * Сложность: O(n + w) где n - количество нод, w - количество проводов.
   *
   * @returns Массив циклов, где каждый цикл представлен как массив UUID нод
   */
  private detectAllCycles(
    pinsByNode: Map<string, Map<PinInstanceType, PinInstance[]>>,
    wiresByPin: Map<string, Wire[]>,
    pinInstancesMap: Map<string, PinInstance>,
    outputPinType: PinInstanceType,
    inputPinType: PinInstanceType,
  ): Array<Array<string>> {
    const cycles: Array<Array<string>> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    // DFS для поиска циклов
    const dfs = (nodeUuid: string): void => {
      if (recursionStack.has(nodeUuid)) {
        // Найден цикл - находим начало цикла в пути
        const cycleStart = path.indexOf(nodeUuid);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycle.push(nodeUuid); // Замыкаем цикл
          cycles.push(cycle);
        }
        return;
      }

      if (visited.has(nodeUuid)) {
        return;
      }

      visited.add(nodeUuid);
      recursionStack.add(nodeUuid);
      path.push(nodeUuid);

      // Получаем выходные пины текущей ноды
      const nodePins = pinsByNode.get(nodeUuid);
      if (nodePins) {
        const currentNodeOutputPins = nodePins.get(outputPinType) || [];

        // Для каждого выходного пина проверяем, куда он ведет
        for (const outputPin of currentNodeOutputPins) {
          const outgoingWires = wiresByPin.get(outputPin.uuid) || [];

          for (const wire of outgoingWires) {
            const inputPin = pinInstancesMap.get(wire.to);
            if (!inputPin || inputPin.type !== inputPinType) {
              continue;
            }

            const nextNodeUuid = inputPin.nodeUuid;
            // Проверяем, не находится ли следующий узел уже в recursionStack
            // Если да, это цикл, и мы его уже обработаем в начале следующего вызова dfs
            dfs(nextNodeUuid);
          }
        }
      }

      recursionStack.delete(nodeUuid);
      path.pop();
    };

    // Запускаем DFS для всех нод
    for (const nodeUuid of pinsByNode.keys()) {
      if (!visited.has(nodeUuid)) {
        dfs(nodeUuid);
      }
    }

    return cycles;
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь.
   * Проверяет, можно ли дойти от startNodeUuid до targetNodeUuid через пины указанных типов.
   *
   * Если индексы переданы (pinsByNode, wiresByPin, pinInstancesMap), использует их.
   * Если нет, использует WiresRegistry для получения индексов проводов.
   *
   * Сложность: O(n + w) при использовании готовых индексов.
   */
  private wouldCreateCycle(
    startNodeUuid: string,
    targetNodeUuid: string,
    outputPinType: PinInstanceType,
    inputPinType: PinInstanceType,
    // Вариант 1: готовые индексы (для validateSnapshot и оптимизированного validateWire)
    pinsByNode?: Map<string, Map<PinInstanceType, PinInstance[]>>,
    wiresByPin?: Map<string, Wire[]>,
    pinInstancesMap?: Map<string, PinInstance>,
    // Вариант 2: WiresRegistry для получения индексов проводов (для validateWire)
    wiresRegistry?: WiresRegistry,
    allPins?: Map<string, PinInstance<any>>,
  ): boolean {
    // Если стартовая нода совпадает с целевой, это цикл
    if (startNodeUuid === targetNodeUuid) {
      return true;
    }

    // Определяем, нужно ли строить индексы
    let finalPinsByNode: Map<string, Map<PinInstanceType, PinInstance[]>>;
    let finalWiresByPin: Map<string, Wire[]> | null = null;
    let finalPinInstancesMap: Map<string, PinInstance>;
    let useWiresRegistry = false;

    if (pinsByNode && wiresByPin && pinInstancesMap) {
      // Используем готовые индексы (для validateSnapshot)
      finalPinsByNode = pinsByNode;
      finalWiresByPin = wiresByPin;
      finalPinInstancesMap = pinInstancesMap;
    } else if (pinsByNode && pinInstancesMap && wiresRegistry) {
      // Используем pre-built pinsByNode индекс и WiresRegistry (оптимизированный путь для validateWire)
      useWiresRegistry = true;
      finalPinsByNode = pinsByNode;
      finalPinInstancesMap = pinInstancesMap;
    } else if (wiresRegistry && allPins) {
      // Используем WiresRegistry для получения проводов - O(1) доступ через индексы
      // ВНИМАНИЕ: Этот путь требует O(p) построения индекса, что неоптимально
      // Предпочитайте передавать pre-built pinsByNode индекс
      useWiresRegistry = true;
      finalPinsByNode = new Map<string, Map<PinInstanceType, PinInstance[]>>();
      finalPinInstancesMap = allPins;

      // Строим индекс пинов по нодам: O(p)
      for (const pin of allPins.values()) {
        let nodePins = finalPinsByNode.get(pin.nodeUuid);
        if (!nodePins) {
          nodePins = new Map();
          finalPinsByNode.set(pin.nodeUuid, nodePins);
        }
        let pinsOfType = nodePins.get(pin.type);
        if (!pinsOfType) {
          pinsOfType = [];
          nodePins.set(pin.type, pinsOfType);
        }
        pinsOfType.push(pin);
      }
    } else {
      throw new CommutatorError(
        "Either provide indexes (pinsByNode, wiresByPin, pinInstancesMap) or WiresRegistry (wiresRegistry, allPins)",
      );
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
      const nodePins = finalPinsByNode.get(currentNodeUuid);
      if (!nodePins) {
        continue;
      }

      const currentNodeOutputPins = nodePins.get(outputPinType) || [];

      // Для каждого выходного пина проверяем, куда он ведет
      for (const outputPin of currentNodeOutputPins) {
        // Получаем провода: O(1) если используем готовые индексы, или через WiresRegistry
        let outgoingWires: Wire[];
        if (useWiresRegistry && wiresRegistry) {
          // Используем WiresRegistry для O(1) доступа к проводам
          outgoingWires = wiresRegistry.getWiresByFromPin(outputPin.uuid);
        } else if (finalWiresByPin) {
          // Используем готовый индекс
          outgoingWires = finalWiresByPin.get(outputPin.uuid) || [];
        } else {
          outgoingWires = [];
        }

        for (const wire of outgoingWires) {
          // Находим входной пин через индекс: O(1)
          const inputPin = finalPinInstancesMap.get(wire.to);
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
   * Валидация обновления конфигурации ноды.
   */
  public validateUpdateNodeConfig(nodeConfig: any, newConfig: unknown): void {
    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    if (nodeConfig.config && newConfig !== undefined) {
      if (!this.validateFieldValue(nodeConfig.config, newConfig)) {
        throw new CommutatorError(`Invalid config for node`);
      }
    }
  }
}
