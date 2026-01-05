import { ulid } from "./util/ulid";
import { CommonDataType, NodeType, PinInstanceType } from "./enums";
import type {
  EventNode,
  EventNodeInstance,
  ExecPin,
  Field,
  FunctionNode,
  FunctionNodeInstance,
  Pin,
  PureFunctionNode,
  PureFunctionNodeInstance,
  RefNode,
  RefNodeInstance,
  Wire,
  PinInstance,
  CommutatorInstanceSnapshot,
} from "./types";
import { CommutatorError } from "./commutator-error";

export class CommutatorSchema<
  const DataTypes extends Record<string, Field<DataTypes>> = {},
  const Events extends Record<
    string,
    EventNode<DataTypes, any, any, any, any, any>
  > = {},
  const Refs extends Record<
    string,
    RefNode<DataTypes, any, any, any, any, any, any>
  > = {},
  const PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, any, any, any, any, any>
  > = {},
  const Functions extends Record<
    string,
    FunctionNode<DataTypes, any, any, any, any, any>
  > = {},
  const Apis extends Record<string, any> = {}
> {
  private eventInstances: Map<string, EventNodeInstance<any>> = new Map();
  private refInstances: Map<string, RefNodeInstance<any>> = new Map();
  private pureFunctionInstances: Map<string, PureFunctionNodeInstance<any>> =
    new Map();
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
    snapshot?: CommutatorInstanceSnapshot
  ) {
    if (snapshot) {
      this.eventInstances = new Map(
        snapshot.events.map((eventInstance) => [
          eventInstance.uuid,
          eventInstance,
        ])
      );
      this.refInstances = new Map(
        snapshot.refs.map((refInstance) => [refInstance.uuid, refInstance])
      );
      this.pureFunctionInstances = new Map(
        snapshot.pureFunctions.map((pureFunctionInstance) => [
          pureFunctionInstance.uuid,
          pureFunctionInstance,
        ])
      );
      this.functionInstances = new Map(
        snapshot.functions.map((functionInstance) => [
          functionInstance.uuid,
          functionInstance,
        ])
      );
      this.pinInstances = new Map(
        snapshot.pinInstances.map((pinInstance) => [
          pinInstance.uuid,
          pinInstance,
        ])
      );
      this.wires = [...snapshot.wires];
    }
  }

  static initialize<
    const DataTypes extends Record<string, Field<DataTypes>> = {},
    const Events extends Record<
      string,
      EventNode<DataTypes, any, any, any, any, any>
    > = {},
    const Refs extends Record<
      string,
      RefNode<DataTypes, any, any, any, any, any, any>
    > = {},
    const PureFunctions extends Record<
      string,
      PureFunctionNode<DataTypes, any, any, any, any, any>
    > = {},
    const Functions extends Record<
      string,
      FunctionNode<DataTypes, any, any, any, any, any>
    > = {},
    const Apis extends Record<string, any> = {}
  >(
    dataTypes: DataTypes = {} as DataTypes,
    events: Events = {} as Events,
    refs: Refs = {} as Refs,
    pureFunctions: PureFunctions = {} as PureFunctions,
    functions: Functions = {} as Functions,
    apis: Apis = {} as Apis,
    snapshot?: CommutatorInstanceSnapshot
  ): CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    // Если есть снапшот проверяем совместимость с конфигурацией комммутатора, проверяем что все типы нод из снапшота совпадают с конфигом
    if (snapshot) {
      for (const eventInstance of snapshot.events) {
        if (!(eventInstance.name in events)) {
          throw new CommutatorError(
            `Event instance "${eventInstance.name}" not found in events configuration`
          );
        }
      }

      for (const refInstance of snapshot.refs) {
        if (!(refInstance.name in refs)) {
          throw new CommutatorError(
            `Ref instance "${refInstance.name}" not found in refs configuration`
          );
        }
      }

      for (const pureFunctionInstance of snapshot.pureFunctions) {
        if (!(pureFunctionInstance.name in pureFunctions)) {
          throw new CommutatorError(
            `PureFunction instance "${pureFunctionInstance.name}" not found in pureFunctions configuration`
          );
        }
      }

      for (const functionInstance of snapshot.functions) {
        if (!(functionInstance.name in functions)) {
          throw new CommutatorError(
            `Function instance "${functionInstance.name}" not found in functions configuration`
          );
        }
      }
    }

    return new CommutatorSchema(
      dataTypes,
      events,
      refs,
      pureFunctions,
      functions,
      apis,
      snapshot
    );
  }

  private createPinInstances(
    nodeUuid: string,
    pinsIn: Record<string, Pin<DataTypes>>,
    pinsOut: Record<string, Pin<DataTypes>>,
    execPinsIn: Record<string, ExecPin>,
    execPinsOut: Record<string, ExecPin>
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

  createEvent<Name extends keyof Events>(name: Name): EventNodeInstance<Name> {
    const eventConfig = this.events[name]!;
    const eventInstance: EventNodeInstance<Name> = {
      uuid: ulid(),
      type: NodeType.Event,
      name,
      x: 0,
      y: 0,
    };

    this.eventInstances.set(eventInstance.uuid, eventInstance);
    this.createPinInstances(
      eventInstance.uuid,
      eventConfig.pinsIn || {},
      eventConfig.pinsOut || {},
      eventConfig.execPinsIn || {},
      eventConfig.execPinsOut || {}
    );

    return eventInstance;
  }

  createRef<Name extends keyof Refs>(name: Name): RefNodeInstance<Name> {
    const refConfig = this.refs[name]!;
    const refInstance: RefNodeInstance<Name> = {
      uuid: ulid(),
      type: NodeType.Ref,
      name,
      x: 0,
      y: 0,
    };

    this.refInstances.set(refInstance.uuid, refInstance);
    this.createPinInstances(
      refInstance.uuid,
      refConfig.pinsIn || {},
      refConfig.pinsOut || {},
      refConfig.execPinsIn || {},
      refConfig.execPinsOut || {}
    );

    return refInstance;
  }

  createPureFunction<Name extends keyof PureFunctions>(
    name: Name
  ): PureFunctionNodeInstance<Name> {
    const pureFunctionConfig = this.pureFunctions[name]!;
    const pureFunctionInstance: PureFunctionNodeInstance<Name> = {
      uuid: ulid(),
      type: NodeType.PureFunction,
      name,
      x: 0,
      y: 0,
    };

    this.pureFunctionInstances.set(
      pureFunctionInstance.uuid,
      pureFunctionInstance
    );
    this.createPinInstances(
      pureFunctionInstance.uuid,
      pureFunctionConfig.pinsIn || {},
      pureFunctionConfig.pinsOut || {},
      pureFunctionConfig.execPinsIn || {},
      pureFunctionConfig.execPinsOut || {}
    );

    return pureFunctionInstance;
  }

  createFunction<Name extends keyof Functions>(
    name: Name
  ): FunctionNodeInstance<Name> {
    const functionConfig = this.functions[name]!;
    const functionInstance: FunctionNodeInstance<Name> = {
      uuid: ulid(),
      type: NodeType.Function,
      name,
      x: 0,
      y: 0,
    };

    this.functionInstances.set(functionInstance.uuid, functionInstance);
    this.createPinInstances(
      functionInstance.uuid,
      functionConfig.pinsIn || {},
      functionConfig.pinsOut || {},
      functionConfig.execPinsIn || {},
      functionConfig.execPinsOut || {}
    );

    return functionInstance;
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
      (fromPin.type === PinInstanceType.Output &&
        toPin.type === PinInstanceType.Input) ||
      (fromPin.type === PinInstanceType.OutputExec &&
        toPin.type === PinInstanceType.InputExec)
    ) {
      outputPin = fromPin;
      inputPin = toPin;
      outputPinUuid = from;
      inputPinUuid = to;
    } else if (
      (fromPin.type === PinInstanceType.Input &&
        toPin.type === PinInstanceType.Output) ||
      (fromPin.type === PinInstanceType.InputExec &&
        toPin.type === PinInstanceType.OutputExec)
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
    if (
      outputPin.type === PinInstanceType.Output &&
      inputPin.type === PinInstanceType.Input
    ) {
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
      const isInputWireExists = this.wires.some(
        (wire) => wire.to === inputPinUuid
      );
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
    this.wires.push(wire);
  }

  /**
   * Отвязка пинов друг от друга. Работает идемпотентно,
   * поэтому можно вызывать даже если не уверен что провод существует
   */
  unwire(from: string, to: string): void {
    this.wires = this.wires.filter(
      (wire) =>
        (wire.from !== from && wire.to !== to) ||
        (wire.from !== to && wire.to !== from)
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
      (currentPin.type === PinInstanceType.Input &&
        !pinNodeConfig.canAddPinIn) ||
      (currentPin.type === PinInstanceType.Output &&
        !pinNodeConfig.canAddPinOut) ||
      (currentPin.type === PinInstanceType.InputExec &&
        !pinNodeConfig.canAddExecPinIn) ||
      (currentPin.type === PinInstanceType.OutputExec &&
        !pinNodeConfig.canAddExecPinOut)
    ) {
      throw new CommutatorError("Cannot remove pin from node");
    }

    const nodePins = [...this.pinInstances.values()].filter(
      (pin) =>
        pin.nodeUuid === currentPin.nodeUuid && pin.type === currentPin.type
    );

    // Если остался 1 пин то выдаём ошибку потому что последний пин удалять нельзя
    if (nodePins.length <= 1) {
      throw new CommutatorError("Cannot remove last pin from node");
    }

    this.pinInstances.delete(uuid);
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь в графе
   * @returns true если соединение создаст цикл, false если нет
   */
  checkCyclicConnection(
    outputPin: PinInstance,
    inputPin: PinInstance
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
      inputPinType
    );
  }

  /**
   * Проверяет, создаст ли соединение циклическую связь
   * Проверяет, можно ли дойти от startNodeUuid до targetNodeUuid через пины указанных типов
   */
  private wouldCreateCycle(
    startNodeUuid: string,
    targetNodeUuid: string,
    outputPinType: PinInstanceType,
    inputPinType: PinInstanceType
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
      const currentNodeUuid = stack.pop()!;

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
        (pin) => pin.nodeUuid === currentNodeUuid && pin.type === outputPinType
      );

      // Для каждого выходного пина проверяем, куда он ведет
      for (const outputPin of currentNodeOutputPins) {
        // Находим все провода, идущие от этого пина
        const outgoingWires = this.wires.filter(
          (wire) => wire.from === outputPin.uuid
        );

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
    return [...this.pinInstances.values()].filter(
      (pinInstance) => pinInstance.nodeUuid === nodeUuid
    );
  }

  extract(): CommutatorInstanceSnapshot {
    return {
      events: [...this.eventInstances.values()],
      refs: [...this.refInstances.values()],
      pureFunctions: [...this.pureFunctionInstances.values()],
      functions: [...this.functionInstances.values()],
      pinInstances: [...this.pinInstances.values()],
      wires: [...this.wires],
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
