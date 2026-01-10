import { PinInstanceType } from "../schema/enums";
import type { AbstractNodeInstance, PinInstance, SchemaSnapshot, Wire } from "../schema/types";
import type { CommutatorConfig } from "./commutator-config";
import { CommutatorError } from "./commutator-error";
import { CommonDataType, PrimitiveDataTypes } from "./enums";
import type { Field, PrimitiveDataType } from "./types";

export class CommutatorValidator<const DataTypes extends Record<string, Field<DataTypes>> = {}> {
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
   * Получает полное определение Field из pinType и конфигурации ноды.
   * Сначала пытается получить из конфигурации ноды (pinsIn/pinsOut), затем из pinType.
   */
  private getFieldFromPin(pin: PinInstance<any>, nodeConfig: any): Field<any> | null {
    if (pin.pinType === null) {
      return null;
    }

    // Пытаемся получить из конфигурации ноды
    const pinConfig =
      pin.type === PinInstanceType.Input || pin.type === PinInstanceType.InputExec
        ? nodeConfig?.pinsIn?.[pin.name]
        : nodeConfig?.pinsOut?.[pin.name];

    // Если pinType это примитивный тип (String, Number, Boolean, Date, Any), создаём простой Field
    // Это работает даже если pinType был изменён динамически
    if (
      pin.pinType === CommonDataType.String ||
      pin.pinType === CommonDataType.Number ||
      pin.pinType === CommonDataType.Boolean ||
      pin.pinType === CommonDataType.Date ||
      pin.pinType === CommonDataType.Any
    ) {
      return { type: pin.pinType } as Field<any>;
    }

    // Если pinType это кастомный тип из DataTypes
    if (typeof pin.pinType === "string" && pin.pinType in this.dataTypes) {
      const customType = this.dataTypes[pin.pinType];
      return customType ?? null;
    }

    // Если в конфигурации есть полное определение Field (Object, Array и т.д.)
    // и оно совпадает с pinType, используем его
    if (pinConfig && typeof pinConfig === "object" && "type" in pinConfig) {
      const configType = pinConfig.type;
      // Если тип в конфигурации совпадает с pinType, используем полное определение
      if (configType === pin.pinType) {
        return pinConfig as Field<any>;
      }
      // Если типы не совпадают (pinType был изменён динамически), но это Object/Array,
      // возвращаем null, чтобы использовать простую проверку
    }

    // Если pinType это Object, Array, StringEnum, NumberEnum, но нет полного определения
    // или тип был изменён динамически, возвращаем null
    // В этом случае будет использована простая проверка (сравнение pinType)
    return null;
  }

  /**
   * Глубокая проверка совместимости двух Field.
   * Проверяет структуру Object, Array, StringEnum, NumberEnum и пользовательские типы.
   */
  private areFieldsCompatible(
    outputField: Field<any>,
    inputField: Field<any>,
    visited: Set<string> = new Set(),
  ): boolean {
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
      const outputValuesSet = new Set(outputValues);
      return inputValues.every((value) => outputValuesSet.has(value));
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
      const outputValuesSet = new Set(outputValues);
      return inputValues.every((value) => outputValuesSet.has(value));
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
  public arePinTypesCompatible(
    outputPin: PinInstance<any>,
    inputPin: PinInstance<any>,
    outputNodeConfig: any,
    inputNodeConfig: any,
  ): boolean {
    // Если оба пина имеют тип Any, они совместимы
    if (outputPin.pinType === CommonDataType.Any && inputPin.pinType === CommonDataType.Any) {
      return true;
    }

    // Если output это Any, он несовместим с другими типами
    if (outputPin.pinType === CommonDataType.Any) {
      return false;
    }

    // Если input принимает Any, всегда совместимо
    if (inputPin.pinType === CommonDataType.Any || inputPin.pinType === null) {
      return true;
    }

    // Если типы не совпадают на верхнем уровне, несовместимы
    if (outputPin.pinType !== inputPin.pinType) {
      return false;
    }

    // Получаем полные определения Field
    const outputField = this.getFieldFromPin(outputPin, outputNodeConfig);
    const inputField = this.getFieldFromPin(inputPin, inputNodeConfig);

    // Если не удалось получить полные определения, используем простую проверку
    if (!outputField || !inputField) {
      return outputPin.pinType === inputPin.pinType;
    }

    // Выполняем глубокую проверку
    return this.areFieldsCompatible(outputField, inputField);
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
   * Проверка существования типа в DataTypes.
   */
  public validatePinType(pinType: any): void {
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
      if (!(pinType in this.dataTypes)) {
        throw new CommutatorError(`Pin type "${String(pinType)}" does not exist in DataTypes`);
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

      if (!this.isValidUuidOrUlid(nodeInstance.uuid)) {
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
        if (!this.validateFieldValue(nodeConfig.config, nodeInstance.config)) {
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

      // Валидация pinType
      if (pinInstance.pinType !== null) {
        this.validatePinType(pinInstance.pinType);
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
        // Проверяем совместимость, если:
        // 1. output имеет тип Any (должен быть несовместим) - всегда проверяем
        // 2. input имеет конкретный тип (не null и не Any) - проверяем
        if (
          fromPin.pinType === CommonDataType.Any ||
          (toPin.pinType !== null && toPin.pinType !== CommonDataType.Any)
        ) {
          // Получаем конфигурации нод для глубокой проверки
          const fromNode = allNodeInstances.find((n) => n.uuid === fromPin.nodeUuid);
          const toNode = allNodeInstances.find((n) => n.uuid === toPin.nodeUuid);

          if (!fromNode || !toNode) {
            throw new CommutatorError("Node instance not found");
          }

          const fromNodeConfig = config.getNodeConfigByName(fromNode.name);
          const toNodeConfig = config.getNodeConfigByName(toNode.name);

          if (!fromNodeConfig || !toNodeConfig) {
            throw new CommutatorError("Node config not found");
          }

          // Глубокая проверка совместимости типов
          if (!this.arePinTypesCompatible(fromPin, toPin, fromNodeConfig, toNodeConfig)) {
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
          this.wouldCreateCycleOptimized(
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
          this.wouldCreateCycleOptimized(
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
  public validateWire(
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
      // Проверяем совместимость, если:
      // 1. output имеет тип Any (должен быть несовместим) - всегда проверяем
      // 2. input имеет конкретный тип (не null и не Any) - проверяем
      if (
        outputPin.pinType === CommonDataType.Any ||
        (inputPin.pinType !== null && inputPin.pinType !== CommonDataType.Any)
      ) {
        if (!this.arePinTypesCompatible(outputPin, inputPin, outputNodeConfig, inputNodeConfig)) {
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
    if (this.checkCyclicConnection(outputPin, inputPin, existingWires, allPins)) {
      throw new CommutatorError("Cyclic connection detected in pins");
    }
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь.
   */
  public checkCyclicConnection(
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

    return this.wouldCreateCycle(
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
  private wouldCreateCycleOptimized(
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
  private wouldCreateCycle(
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
