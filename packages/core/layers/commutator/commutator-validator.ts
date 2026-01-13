import { PinInstanceType } from "../schema/enums";
import type { NodesRegistry } from "../schema/nodes-registry";
import type { PinsRegistry } from "../schema/pins-registry";
import type { PinInstance } from "../schema/types";
import type { WiresRegistry } from "../schema/wires-registry";
import { CommutatorError } from "./commutator-error";
import { CommonDataType, PrimitiveDataTypes } from "./enums";
import type { Field, PrimitiveDataType } from "./types";

export class CommutatorValidator<const DataTypes extends Record<string, Field<DataTypes>> = {}> {
  constructor(private readonly dataTypes: DataTypes) {}

  public hasDataType(name: PropertyKey): name is keyof DataTypes | PrimitiveDataType {
    return name in this.dataTypes || PrimitiveDataTypes.includes(name as PrimitiveDataType);
  }

  public validateField(field: Field<DataTypes>): void {
    if (!field || typeof field !== "object") {
      throw new CommutatorError("Field is invalid");
    }

    if (!field.type || typeof field.type !== "string") {
      throw new CommutatorError("Field type is invalid");
    }

    if (
      field.type === CommonDataType.Any ||
      field.type === CommonDataType.String ||
      field.type === CommonDataType.Number ||
      field.type === CommonDataType.Boolean ||
      field.type === CommonDataType.Date
    ) {
      return;
    }

    if (field.type === CommonDataType.Object) {
      if (!("properties" in field) || typeof field.properties !== "object") {
        throw new CommutatorError("Field properties is invalid");
      }

      for (const property of Object.values(field.properties)) {
        this.validateField(property);
      }
    }

    if (field.type === CommonDataType.Array) {
      if (!("itemType" in field) || typeof field.itemType !== "object") {
        throw new CommutatorError("Field itemType is invalid");
      }

      this.validateField(field.itemType);
    }

    if (field.type === CommonDataType.StringEnum) {
      if (!("values" in field) || !Array.isArray(field.values)) {
        throw new CommutatorError("Field values is invalid");
      }

      if (field.values.some((value) => typeof value !== "string")) {
        throw new CommutatorError("Field values must be strings");
      }
    }

    if (field.type === CommonDataType.NumberEnum) {
      if (!("values" in field) || !Array.isArray(field.values)) {
        throw new CommutatorError("Field values is invalid");
      }

      if (field.values.some((value) => typeof value !== "number")) {
        throw new CommutatorError("Field values must be numbers");
      }
    }

    if (typeof field.type === "string" && !this.dataTypes[field.type]) {
      const customField = this.dataTypes[field.type];

      if (!customField) {
        throw new CommutatorError(`Field type "${field.type}" does not exist in DataTypes`);
      }

      this.validateField(customField);
    }
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
    outputPin: PinInstance<DataTypes>,
    inputPin: PinInstance<DataTypes>,
  ): boolean {
    if (
      outputPin.type === PinInstanceType.OutputExec &&
      inputPin.type === PinInstanceType.InputExec
    ) {
      return true;
    }

    // Если хоть один из пинов null, но тип пинов не outputExec и inputExec, то несовместимы
    if (outputPin.dataType === null || inputPin.dataType === null) {
      return false;
    }

    // Если input принимает Any, всегда совместимо
    if (inputPin.dataType.type === CommonDataType.Any) {
      return true;
    }

    // Если output это Any, но input не Any, то output несовместим с другими типами
    if (outputPin.dataType.type === CommonDataType.Any) {
      return false;
    }

    // Если типы не совпадают на верхнем уровне, пины несовместимы
    if (outputPin.dataType.type !== inputPin.dataType.type) {
      return false;
    }

    // Выполняем глубокую проверку
    return this.areFieldsCompatible(outputPin.dataType, inputPin.dataType);
  }

  /**
   * Валидация операции wire.
   */
  public validateWire(
    fromPin: PinInstance<DataTypes>,
    toPin: PinInstance<DataTypes>,
    wiresRegistry: WiresRegistry<DataTypes>,
    nodesRegistry: NodesRegistry<DataTypes>,
  ): void {
    if (fromPin.uuid === toPin.uuid) {
      throw new CommutatorError(`Self-loop detected: pin ${fromPin.uuid} connected to itself`);
    }

    if (fromPin.nodeUuid === toPin.nodeUuid) {
      throw new CommutatorError(
        `Cannot connect pin "${fromPin.uuid}" to pin "${toPin.uuid}" from the same node "${fromPin.nodeUuid}"`,
      );
    }

    if (fromPin.type === PinInstanceType.Input || fromPin.type === PinInstanceType.InputExec) {
      throw new CommutatorError(`From pin cannot be Input or InputExec`);
    }

    if (toPin.type === PinInstanceType.Output || toPin.type === PinInstanceType.OutputExec) {
      throw new CommutatorError(`To pin cannot be Output or OutputExec`);
    }

    if (
      !(
        (fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input) ||
        (fromPin.type === PinInstanceType.OutputExec && toPin.type === PinInstanceType.InputExec)
      )
    ) {
      throw new CommutatorError(
        `Cannot connect pin "${fromPin.uuid}" to pin "${toPin.uuid}" with incompatible data types`,
      );
    }

    if (
      fromPin.type === PinInstanceType.Output &&
      toPin.type === PinInstanceType.Input &&
      !this.arePinDataTypesCompatible(fromPin, toPin)
    ) {
      throw new CommutatorError(
        `Cannot connect pin "${fromPin.uuid}" to pin "${toPin.uuid}" with incompatible data types`,
      );
    }

    // Если тип пина outputExec, то он может иметь только один выходной пин
    if (
      fromPin.type === PinInstanceType.OutputExec &&
      wiresRegistry.hasOutgoingWire(fromPin.uuid)
    ) {
      throw new CommutatorError(`OutputExec pin "${fromPin.uuid}" can have only one outgoing wire`);
    }

    if (toPin.type === PinInstanceType.Input && wiresRegistry.hasIncomingWire(toPin.uuid)) {
      throw new CommutatorError(`Input pin "${toPin.uuid}" can have only one incoming wire`);
    }

    // Проверка существования нод
    const outputNode = nodesRegistry.getNodeByUuid(fromPin.nodeUuid);
    const inputNode = nodesRegistry.getNodeByUuid(toPin.nodeUuid);

    if (!outputNode || !inputNode) {
      throw new CommutatorError(`Node not found: "${fromPin.nodeUuid}" or "${toPin.nodeUuid}"`);
    }
  }

  /**
   * Проверяет, есть ли циклические связи в графе
   */
  /**
   * Проверяет, есть ли циклические связи в графе (topological / Kahn)
   */
  public checkCyclesInGraph(
    nodesRegistry: NodesRegistry,
    pinsRegistry: PinsRegistry,
    wiresRegistry: WiresRegistry<DataTypes>,
    wireType: "exec" | "data",
  ): boolean {
    const adjacency = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    // pinUuid -> nodeUuid (только нужные пины)
    const pinToNode = new Map<string, string>();

    // 1. Инициализация нод
    for (const node of nodesRegistry.getAllNodesIterator()) {
      adjacency.set(node.uuid, new Set());
      inDegree.set(node.uuid, 0);

      for (const pin of pinsRegistry.getPinsByNodeUuid(node.uuid)) {
        if (
          wireType === "data" &&
          (pin.type === PinInstanceType.Input || pin.type === PinInstanceType.Output)
        ) {
          pinToNode.set(pin.uuid, node.uuid);
        }

        if (
          wireType === "exec" &&
          (pin.type === PinInstanceType.InputExec || pin.type === PinInstanceType.OutputExec)
        ) {
          pinToNode.set(pin.uuid, node.uuid);
        }
      }
    }

    // 2. Построение графа (node -> node)
    for (const [fromPin, fromNode] of pinToNode) {
      const wires = wiresRegistry.getWiresByFromPin(fromPin);
      if (wires.length === 0) continue;

      for (const wire of wires) {
        const toNode = pinToNode.get(wire.to);
        if (!toNode) continue; // другой тип пинов

        // игнорируем self-loop на уровне пинов, но учитываем на уровне нод
        if (!adjacency.get(fromNode)!.has(toNode)) {
          adjacency.get(fromNode)!.add(toNode);
          inDegree.set(toNode, inDegree.get(toNode)! + 1);
        }
      }
    }

    // 3. Алгоритм Кана
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    let visitedCount = 0;

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      visitedCount++;

      for (const next of adjacency.get(nodeId)!) {
        const deg = inDegree.get(next)! - 1;
        inDegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }

    // если обработали не все ноды — есть цикл
    return visitedCount !== adjacency.size;
  }

  /**
   * Проверяет, создаст ли новый wire цикл (инкрементально)
   * Вызывать ПЕРЕД addWire
   */
  public willCreateCycleInteractive(
    pinsRegistry: PinsRegistry<DataTypes>,
    wiresRegistry: WiresRegistry<DataTypes>,
    wireType: "exec" | "data",
    newWire: { from: string; to: string },
  ): boolean {
    const pinToNode = pinsRegistry.getPinsToNodeIndex();

    const fromNode = pinToNode.get(newWire.from);
    const toNode = pinToNode.get(newWire.to);

    if (!fromNode || !toNode) {
      return false;
    }

    if (fromNode === toNode) {
      return true;
    }

    const nodeOutPins =
      wireType === "exec"
        ? pinsRegistry.getNodeOutExecPinsIndex()
        : pinsRegistry.getNodeOutPinsIndex();

    // DFS от toNode → ищем fromNode
    const stack: string[] = [toNode];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const currentNode = stack.pop()!;
      if (currentNode === fromNode) return true;
      if (visited.has(currentNode)) continue;
      visited.add(currentNode);

      const outPins = nodeOutPins.get(currentNode);
      if (!outPins) continue;

      for (const pin of outPins) {
        const wires = wiresRegistry.getWiresByFromPin(pin.uuid);
        for (const wire of wires) {
          const nextNode = pinToNode.get(wire.to);
          if (nextNode) stack.push(nextNode);
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
