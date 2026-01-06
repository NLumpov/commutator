import { CommutatorError } from "./commutator-error";
import { CommonDataType, NodeType, PinInstanceType } from "./enums";
import type {
  AbstractNodeInstance,
  CommutatorInstanceSnapshot,
  EventNode,
  EventNodeInstance,
  ExecPin,
  Field,
  FieldValue,
  FunctionNode,
  FunctionNodeInstance,
  Pin,
  PinInstance,
  PureFunctionNode,
  PureFunctionNodeInstance,
  RefNode,
  RefNodeInstance,
  Wire,
} from "./types";
import { ulid } from "./util/ulid";

export class CommutatorSchema<
  const DataTypes extends Record<string, Field<DataTypes>> = {},
  const Events extends Record<string, EventNode<DataTypes, any, any, any, any, any, any>> = {},
  const Refs extends Record<string, RefNode<DataTypes, any, any, any, any, any, any, any>> = {},
  const PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, any, any, any, any, any, any>
  > = {},
  const Functions extends Record<
    string,
    FunctionNode<DataTypes, any, any, any, any, any, any>
  > = {},
  const Apis extends Record<string, any> = {},
> {
  private eventInstances: Map<string, EventNodeInstance<any>> = new Map();
  private refInstances: Map<string, RefNodeInstance<any>> = new Map();
  private pureFunctionInstances: Map<string, PureFunctionNodeInstance<any>> = new Map();
  private functionInstances: Map<string, FunctionNodeInstance<any>> = new Map();
  private pinInstances: Map<string, PinInstance> = new Map();
  private wires: Wire[] = [];

  private constructor(
    private dataTypes: DataTypes,
    private events: Events,
    private refs: Refs,
    private pureFunctions: PureFunctions,
    private functions: Functions,
    private apis: Apis,
    snapshot?: CommutatorInstanceSnapshot,
  ) {
    if (snapshot) {
      this.eventInstances = new Map(
        snapshot.events.map((eventInstance) => [eventInstance.uuid, { ...eventInstance }]),
      );
      this.refInstances = new Map(
        snapshot.refs.map((refInstance) => [refInstance.uuid, { ...refInstance }]),
      );
      this.pureFunctionInstances = new Map(
        snapshot.pureFunctions.map((pureFunctionInstance) => [
          pureFunctionInstance.uuid,
          { ...pureFunctionInstance },
        ]),
      );
      this.functionInstances = new Map(
        snapshot.functions.map((functionInstance) => [
          functionInstance.uuid,
          { ...functionInstance },
        ]),
      );
      this.pinInstances = new Map(
        snapshot.pinInstances.map((pinInstance) => [pinInstance.uuid, { ...pinInstance }]),
      );
      this.wires = snapshot.wires.map((wire) => ({ ...wire }));
    }
  }

  static initialize<
    const DataTypes extends Record<string, Field<DataTypes>> = {},
    const Events extends Record<string, EventNode<DataTypes, any, any, any, any, any, any>> = {},
    const Refs extends Record<string, RefNode<DataTypes, any, any, any, any, any, any, any>> = {},
    const PureFunctions extends Record<
      string,
      PureFunctionNode<DataTypes, any, any, any, any, any, any>
    > = {},
    const Functions extends Record<
      string,
      FunctionNode<DataTypes, any, any, any, any, any, any>
    > = {},
    const Apis extends Record<string, any> = {},
  >(
    dataTypes: DataTypes = {} as DataTypes,
    events: Events = {} as Events,
    refs: Refs = {} as Refs,
    pureFunctions: PureFunctions = {} as PureFunctions,
    functions: Functions = {} as Functions,
    apis: Apis = {} as Apis,
    snapshot?: CommutatorInstanceSnapshot,
  ): CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    // Если есть снапшот проверяем совместимость с конфигурацией комммутатора, проверяем что все типы нод из снапшота совпадают с конфигом
    if (snapshot) {
      // Проверяем существование конфигураций нод и корректность dataTypes во всех пинах
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

      // Собираем все instance'ы в единый массив
      const allInstances: AbstractNodeInstance<string>[] = [
        ...snapshot.events,
        ...snapshot.refs,
        ...snapshot.pureFunctions,
        ...snapshot.functions,
      ];

      for (const instance of allInstances) {
        const nodeConfig =
          events[instance.name] ||
          refs[instance.name] ||
          pureFunctions[instance.name] ||
          functions[instance.name];

        if (!nodeConfig) {
          throw new CommutatorError(
            `Node config for "${instance.name}" of type "${instance.type}" not found`,
          );
        }

        for (const pins of [nodeConfig.pinsIn, nodeConfig.pinsOut]) {
          if (!pins) continue;
          for (const [pinName, pin] of Object.entries(pins) as [string, Pin<DataTypes>][]) {
            if (
              typeof pin.type === "string" &&
              !commonDataTypeValues.has(pin.type) &&
              !(pin.type in dataTypes)
            ) {
              throw new CommutatorError(
                `Pin "${pinName}" in ${instance.type} "${instance.name}" references non-existent dataType "${pin.type}"`,
              );
            }
          }
        }
      }
    }

    return new CommutatorSchema(dataTypes, events, refs, pureFunctions, functions, apis, snapshot);
  }

  private createPinInstances(
    nodeUuid: string,
    pinsIn: Record<string, Pin<DataTypes>>,
    pinsOut: Record<string, Pin<DataTypes>>,
    execPinsIn: Record<string, ExecPin>,
    execPinsOut: Record<string, ExecPin>,
  ): void {
    for (const { pins, type } of [
      { pins: pinsIn, type: PinInstanceType.Input },
      { pins: pinsOut, type: PinInstanceType.Output },
      { pins: execPinsIn, type: PinInstanceType.InputExec },
      { pins: execPinsOut, type: PinInstanceType.OutputExec },
    ]) {
      for (const [pinName] of Object.entries(pins)) {
        const pinInstance: PinInstance = {
          nodeUuid,
          uuid: ulid(),
          type,
          name: pinName,
        };
        this.pinInstances.set(pinInstance.uuid, pinInstance);
      }
    }
  }

  createEvent<Name extends keyof Events, Config extends Events[Name]["config"]>(
    name: Name,
    config?: FieldValue<Config, DataTypes>,
  ): EventNodeInstance<Name> {
    const eventConfig = this.events[name];

    if (!eventConfig) {
      throw new CommutatorError(`Event config for "${String(name)}" not found`);
    }

    if (
      eventConfig.config &&
      config !== undefined &&
      !this.validateFieldValue(eventConfig.config, config)
    ) {
      throw new CommutatorError(`Invalid config for event "${String(name)}"`);
    }

    const eventInstance: EventNodeInstance<Name> = {
      uuid: ulid(),
      type: NodeType.Event,
      name,
      x: 0,
      y: 0,
      config,
    };

    this.eventInstances.set(eventInstance.uuid, eventInstance);
    this.createPinInstances(
      eventInstance.uuid,
      eventConfig.pinsIn || {},
      eventConfig.pinsOut || {},
      eventConfig.execPinsIn || {},
      eventConfig.execPinsOut || {},
    );

    return { ...eventInstance };
  }

  createRef<Name extends keyof Refs, Config extends Refs[Name]["config"]>(
    name: Name,
    config?: FieldValue<Config, DataTypes>,
  ): RefNodeInstance<Name> {
    const refConfig = this.refs[name];

    if (!refConfig) {
      throw new CommutatorError(`Ref config for "${String(name)}" not found`);
    }

    if (
      refConfig.config &&
      config !== undefined &&
      !this.validateFieldValue(refConfig.config, config)
    ) {
      throw new CommutatorError(`Invalid config for ref "${String(name)}"`);
    }

    const refInstance: RefNodeInstance<Name> = {
      uuid: ulid(),
      type: NodeType.Ref,
      name,
      x: 0,
      y: 0,
      config,
    };

    this.refInstances.set(refInstance.uuid, refInstance);
    this.createPinInstances(
      refInstance.uuid,
      refConfig.pinsIn || {},
      refConfig.pinsOut || {},
      refConfig.execPinsIn || {},
      refConfig.execPinsOut || {},
    );

    return { ...refInstance };
  }

  createPureFunction<Name extends keyof PureFunctions>(
    name: Name,
    config?: FieldValue<PureFunctions[Name]["config"], DataTypes>,
  ): PureFunctionNodeInstance<Name> {
    const pureFunctionConfig = this.pureFunctions[name];

    if (!pureFunctionConfig) {
      throw new CommutatorError(`Pure function config for "${String(name)}" not found`);
    }

    if (
      pureFunctionConfig.config &&
      config !== undefined &&
      !this.validateFieldValue(pureFunctionConfig.config, config)
    ) {
      throw new CommutatorError(`Invalid config for pure function "${String(name)}"`);
    }

    const pureFunctionInstance: PureFunctionNodeInstance<Name> = {
      uuid: ulid(),
      type: NodeType.PureFunction,
      name,
      x: 0,
      y: 0,
      config,
    };

    this.pureFunctionInstances.set(pureFunctionInstance.uuid, pureFunctionInstance);
    this.createPinInstances(
      pureFunctionInstance.uuid,
      pureFunctionConfig.pinsIn || {},
      pureFunctionConfig.pinsOut || {},
      pureFunctionConfig.execPinsIn || {},
      pureFunctionConfig.execPinsOut || {},
    );

    return { ...pureFunctionInstance };
  }

  createFunction<Name extends keyof Functions>(
    name: Name,
    config?: FieldValue<Functions[Name]["config"], DataTypes>,
  ): FunctionNodeInstance<Name> {
    const functionConfig = this.functions[name];

    if (!functionConfig) {
      throw new CommutatorError(`Function config for "${String(name)}" not found`);
    }

    if (
      functionConfig.config &&
      config !== undefined &&
      !this.validateFieldValue(functionConfig.config, config)
    ) {
      throw new CommutatorError(`Invalid config for function "${String(name)}"`);
    }

    const functionInstance: FunctionNodeInstance<Name> = {
      uuid: ulid(),
      type: NodeType.Function,
      name,
      x: 0,
      y: 0,
      config,
    };

    this.functionInstances.set(functionInstance.uuid, functionInstance);
    this.createPinInstances(
      functionInstance.uuid,
      functionConfig.pinsIn || {},
      functionConfig.pinsOut || {},
      functionConfig.execPinsIn || {},
      functionConfig.execPinsOut || {},
    );

    return { ...functionInstance };
  }

  wire(from: string, to: string): void {
    const fromPin = this.pinInstances.get(from);
    const toPin = this.pinInstances.get(to);

    if (!fromPin || !toPin) {
      throw new CommutatorError("Pin not found");
    }

    if (from === to) {
      throw new CommutatorError("Self-loop");
    }

    // Определяем выходной и входной пины
    let outputPin: PinInstance;
    let inputPin: PinInstance;
    let outputPinUuid: string;
    let inputPinUuid: string;

    if (
      (fromPin.type === PinInstanceType.Output && toPin.type === PinInstanceType.Input) ||
      (fromPin.type === PinInstanceType.OutputExec && toPin.type === PinInstanceType.InputExec)
    ) {
      outputPin = fromPin;
      inputPin = toPin;
      outputPinUuid = from;
      inputPinUuid = to;
    } else if (
      (fromPin.type === PinInstanceType.Input && toPin.type === PinInstanceType.Output) ||
      (fromPin.type === PinInstanceType.InputExec && toPin.type === PinInstanceType.OutputExec)
    ) {
      outputPin = toPin;
      inputPin = fromPin;
      outputPinUuid = to;
      inputPinUuid = from;
    } else {
      throw new CommutatorError("Invalid connection");
    }

    // Находим ноды по uuid
    const outputNodeInstance =
      this.eventInstances.get(outputPin.nodeUuid) ||
      this.refInstances.get(outputPin.nodeUuid) ||
      this.pureFunctionInstances.get(outputPin.nodeUuid) ||
      this.functionInstances.get(outputPin.nodeUuid);

    const inputNodeInstance =
      this.eventInstances.get(inputPin.nodeUuid) ||
      this.refInstances.get(inputPin.nodeUuid) ||
      this.pureFunctionInstances.get(inputPin.nodeUuid) ||
      this.functionInstances.get(inputPin.nodeUuid);

    if (!outputNodeInstance || !inputNodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    // Получаем конфигурацию нод
    const outputNodeConfig =
      this.events[outputNodeInstance.name as keyof Events] ||
      this.refs[outputNodeInstance.name as keyof Refs] ||
      this.pureFunctions[outputNodeInstance.name as keyof PureFunctions] ||
      this.functions[outputNodeInstance.name as keyof Functions];

    const inputNodeConfig =
      this.events[inputNodeInstance.name as keyof Events] ||
      this.refs[inputNodeInstance.name as keyof Refs] ||
      this.pureFunctions[inputNodeInstance.name as keyof PureFunctions] ||
      this.functions[inputNodeInstance.name as keyof Functions];

    if (!outputNodeConfig || !inputNodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Проверяем типы для data pins
    if (outputPin.type === PinInstanceType.Output && inputPin.type === PinInstanceType.Input) {
      // Находим пины в конфигурации
      const outputPinConfig = outputNodeConfig.pinsOut[outputPin.name];
      const inputPinConfig = inputNodeConfig.pinsIn[inputPin.name];

      if (!outputPinConfig || !inputPinConfig) {
        throw new CommutatorError("Pin config not found");
      }

      // Проверяем совместимость типов
      // Если inputPin имеет тип Any, то принимает любой тип
      if (inputPinConfig.type !== CommonDataType.Any) {
        if (outputPinConfig.type !== inputPinConfig.type) {
          throw new CommutatorError("Type mismatch");
        }
      }

      // Для data pins (pinIn) может быть только один входной провод
      const isInputWireExists = this.wires.some((wire) => wire.to === inputPinUuid);
      if (isInputWireExists) {
        throw new CommutatorError("To wire already exists");
      }
    }

    // Для exec pins разрешаем множественные входы, не проверяем существование провода

    // Проверяем циклические связи
    if (this.checkCyclicConnection(outputPin, inputPin)) {
      throw new CommutatorError("Cyclic connection detected in pins");
    }

    // Создаем провод и добавляем его в массив
    const wire: Wire = {
      from: outputPinUuid,
      to: inputPinUuid,
    };
    this.wires = [...this.wires, wire];
  }

  /**
   * Отвязка пинов друг от друга. Работает идемпотентно,
   * поэтому можно вызывать даже если не уверен что провод существует
   */
  unwire(from: string, to: string): void {
    this.wires = this.wires.filter(
      (wire) => (wire.from !== from && wire.to !== to) || (wire.from !== to && wire.to !== from),
    );
  }

  /**
   * Добавление пина в ноду. Выдаст ошибку, если в настройках ноды запрещено добавлять пины данного типа
   */
  addPin(nodeUuid: string, name: string, type: PinInstanceType): void {
    const nodeInstance =
      this.eventInstances.get(nodeUuid) ||
      this.refInstances.get(nodeUuid) ||
      this.pureFunctionInstances.get(nodeUuid) ||
      this.functionInstances.get(nodeUuid);

    if (!nodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    const nodeConfig =
      this.events[nodeInstance.name] ||
      this.refs[nodeInstance.name] ||
      this.pureFunctions[nodeInstance.name] ||
      this.functions[nodeInstance.name];

    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    if (
      (type === PinInstanceType.Input && !nodeConfig.canAddPinIn) ||
      (type === PinInstanceType.Output && !nodeConfig.canAddPinOut) ||
      (type === PinInstanceType.InputExec && !nodeConfig.canAddExecPinIn) ||
      (type === PinInstanceType.OutputExec && !nodeConfig.canAddExecPinOut)
    ) {
      throw new CommutatorError("Cannot add pin to node");
    }

    const pinInstance: PinInstance = {
      nodeUuid,
      uuid: ulid(),
      type,
      name,
    };

    this.pinInstances.set(pinInstance.uuid, pinInstance);
  }

  removePin(uuid: string): void {
    const currentPin = this.pinInstances.get(uuid);

    if (!currentPin) {
      throw new CommutatorError("Pin instance not found");
    }

    const pinNodeInstance =
      this.eventInstances.get(currentPin.nodeUuid) ||
      this.refInstances.get(currentPin.nodeUuid) ||
      this.pureFunctionInstances.get(currentPin.nodeUuid) ||
      this.functionInstances.get(currentPin.nodeUuid);

    if (!pinNodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    const pinNodeConfig =
      this.events[pinNodeInstance.name] ||
      this.refs[pinNodeInstance.name] ||
      this.pureFunctions[pinNodeInstance.name] ||
      this.functions[pinNodeInstance.name];

    if (!pinNodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Если нельзя менять пины то выдаём ошибку
    if (
      (currentPin.type === PinInstanceType.Input && !pinNodeConfig.canAddPinIn) ||
      (currentPin.type === PinInstanceType.Output && !pinNodeConfig.canAddPinOut) ||
      (currentPin.type === PinInstanceType.InputExec && !pinNodeConfig.canAddExecPinIn) ||
      (currentPin.type === PinInstanceType.OutputExec && !pinNodeConfig.canAddExecPinOut)
    ) {
      throw new CommutatorError("Cannot remove pin from node");
    }

    const nodePins = [...this.pinInstances.values()].filter(
      (pin) => pin.nodeUuid === currentPin.nodeUuid && pin.type === currentPin.type,
    );

    // Если остался 1 пин то выдаём ошибку потому что последний пин удалять нельзя
    if (nodePins.length <= 1) {
      throw new CommutatorError("Cannot remove last pin from node");
    }

    this.pinInstances.delete(uuid);
  }

  moveNode(uuid: string, x: number, y: number): void {
    const nodeInstance =
      this.eventInstances.get(uuid) ||
      this.refInstances.get(uuid) ||
      this.pureFunctionInstances.get(uuid) ||
      this.functionInstances.get(uuid);
    if (!nodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    switch (nodeInstance.type) {
      case NodeType.Event:
        this.eventInstances.set(uuid, { ...nodeInstance, x, y });
        break;
      case NodeType.Ref:
        this.refInstances.set(uuid, { ...nodeInstance, x, y });
        break;
      case NodeType.PureFunction:
        this.pureFunctionInstances.set(uuid, { ...nodeInstance, x, y });
        break;
      case NodeType.Function:
        this.functionInstances.set(uuid, { ...nodeInstance, x, y });
        break;
      default:
        throw new CommutatorError("Unknown node type");
    }
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь в графе
   * @returns true если соединение создаст цикл, false если нет
   */
  checkCyclicConnection(outputPin: PinInstance, inputPin: PinInstance): boolean {
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

    return this.wouldCreateCycle(inputNodeUuid, outputNodeUuid, outputPinType, inputPinType);
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь
   * Проверяет, можно ли дойти от startNodeUuid до targetNodeUuid через пины указанных типов
   */
  private wouldCreateCycle(
    startNodeUuid: string,
    targetNodeUuid: string,
    outputPinType: PinInstanceType,
    inputPinType: PinInstanceType,
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

      // Находим все выходные пины текущей ноды указанного типа
      const currentNodeOutputPins = [...this.pinInstances.values()].filter(
        (pin) => pin.nodeUuid === currentNodeUuid && pin.type === outputPinType,
      );

      // Для каждого выходного пина проверяем, куда он ведет
      for (const outputPin of currentNodeOutputPins) {
        // Находим все провода, идущие от этого пина
        const outgoingWires = this.wires.filter((wire) => wire.from === outputPin.uuid);

        for (const wire of outgoingWires) {
          // Находим входной пин, к которому ведет провод
          const inputPin = this.pinInstances.get(wire.to);
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

  getNodePins(nodeUuid: string): PinInstance[] {
    const result: PinInstance[] = [];
    for (const pinInstance of this.pinInstances.values()) {
      if (pinInstance.nodeUuid === nodeUuid) {
        result.push({ ...pinInstance });
      }
    }
    return result;
  }

  validateFieldValue(field: Field<DataTypes>, value: unknown): boolean {
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

  extract(): CommutatorInstanceSnapshot {
    const events: EventNodeInstance<any>[] = [];
    for (const event of this.eventInstances.values()) {
      events.push({ ...event });
    }

    const refs: RefNodeInstance<any>[] = [];
    for (const ref of this.refInstances.values()) {
      refs.push({ ...ref });
    }

    const pureFunctions: PureFunctionNodeInstance<any>[] = [];
    for (const pureFunc of this.pureFunctionInstances.values()) {
      pureFunctions.push({ ...pureFunc });
    }

    const functions: FunctionNodeInstance<any>[] = [];
    for (const func of this.functionInstances.values()) {
      functions.push({ ...func });
    }

    const pinInstances: PinInstance[] = [];
    for (const pin of this.pinInstances.values()) {
      pinInstances.push({ ...pin });
    }

    const wires: Wire[] = [];
    for (const wire of this.wires) {
      wires.push({ ...wire });
    }

    return {
      events,
      refs,
      pureFunctions,
      functions,
      pinInstances,
      wires,
    };
  }
}

// TODO функция выгрузки текущего инстанса
// TODO функция создания инстанса из выгрузки
// Сначала сделать выгрузку и загрузку инстанса
// Потом уже заниматься отработкой инстансов т.к. хз как она должна работать
// В идеале в бд должен лежать просто кеш привязанный к запуску

// Сделать три слоя
// Коммутатор, schema и instance
// коммутатор - конфигурация типов и нод, уже готова
// schema - граф сделанный на онове типов и нод, уже готов
// instance - запуск, не готов
