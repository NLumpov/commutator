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
} from "./types";

export class CommutatorInstance<
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
  private constructor(
    private dataTypes: DataTypes,
    private events: Events,
    private refs: Refs,
    private pureFunctions: PureFunctions,
    private functions: Functions,
    private apis: Apis,
    private eventInstances: Record<string, EventNodeInstance<any>> = {},
    private refInstances: Record<string, RefNodeInstance<any>> = {},
    private pureFunctionInstances: Record<
      string,
      PureFunctionNodeInstance<any>
    > = {},
    private functionInstances: Record<string, FunctionNodeInstance<any>> = {},
    private pinInstances: Record<string, PinInstance> = {},
    private wires: Wire[] = []
  ) {}

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
    apis: Apis = {} as Apis
  ): CommutatorInstance<
    DataTypes,
    Events,
    Refs,
    PureFunctions,
    Functions,
    Apis
  > {
    return new CommutatorInstance(
      dataTypes,
      events,
      refs,
      pureFunctions,
      functions,
      apis
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
        this.pinInstances[pinInstance.uuid] = pinInstance;
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

    this.eventInstances[eventInstance.uuid] = eventInstance;
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

    this.refInstances[refInstance.uuid] = refInstance;
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

    this.pureFunctionInstances[pureFunctionInstance.uuid] =
      pureFunctionInstance;
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

    this.functionInstances[functionInstance.uuid] = functionInstance;
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
    const fromPin = this.pinInstances[from];
    const toPin = this.pinInstances[to];

    if (!fromPin || !toPin) {
      throw new Error("Pin not found");
    }

    if (from === to) {
      throw new Error("Self-loop");
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
      throw new Error("Invalid connection");
    }

    // Находим ноды по uuid
    const outputNodeInstance =
      this.eventInstances[outputPin.nodeUuid] ||
      this.refInstances[outputPin.nodeUuid] ||
      this.pureFunctionInstances[outputPin.nodeUuid] ||
      this.functionInstances[outputPin.nodeUuid];

    const inputNodeInstance =
      this.eventInstances[inputPin.nodeUuid] ||
      this.refInstances[inputPin.nodeUuid] ||
      this.pureFunctionInstances[inputPin.nodeUuid] ||
      this.functionInstances[inputPin.nodeUuid];

    if (!outputNodeInstance || !inputNodeInstance) {
      throw new Error("Node instance not found");
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
      throw new Error("Node config not found");
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
        throw new Error("Pin config not found");
      }

      // Проверяем совместимость типов
      // Если inputPin имеет тип Any, то принимает любой тип
      if (inputPinConfig.type !== CommonDataType.Any) {
        if (outputPinConfig.type !== inputPinConfig.type) {
          throw new Error("Type mismatch");
        }
      }

      // Для data pins (pinIn) может быть только один входной провод
      const isInputWireExists = this.wires.some(
        (wire) => wire.to === inputPinUuid
      );
      if (isInputWireExists) {
        throw new Error("To wire already exists");
      }
    }

    // Для exec pins разрешаем множественные входы, не проверяем существование провода

    // Проверяем циклические связи
    this.checkCyclicConnection(outputPin, inputPin);

    // Создаем провод и добавляем его в массив
    const wire: Wire = {
      from: outputPinUuid,
      to: inputPinUuid,
    };
    this.wires.push(wire);
  }

  /**
   * Проверяет, не создаст ли соединение циклическую связь в графе
   */
  private checkCyclicConnection(
    outputPin: PinInstance,
    inputPin: PinInstance
  ): void {
    const outputNodeUuid = outputPin.nodeUuid;
    const inputNodeUuid = inputPin.nodeUuid;

    // Определяем типы пинов для проверки
    let outputPinType: PinInstanceType;
    let inputPinType: PinInstanceType;
    let errorMessage: string;

    if (
      outputPin.type === PinInstanceType.OutputExec &&
      inputPin.type === PinInstanceType.InputExec
    ) {
      outputPinType = PinInstanceType.OutputExec;
      inputPinType = PinInstanceType.InputExec;
      errorMessage = "Cyclic connection detected in exec pins";
    } else if (
      outputPin.type === PinInstanceType.Output &&
      inputPin.type === PinInstanceType.Input
    ) {
      outputPinType = PinInstanceType.Output;
      inputPinType = PinInstanceType.Input;
      errorMessage = "Cyclic connection detected in data pins";
    } else {
      // Не проверяем циклы для других комбинаций типов
      return;
    }

    if (this.wouldCreateCycle(inputNodeUuid, outputNodeUuid, outputPinType, inputPinType)) {
      throw new Error(errorMessage);
    }
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
    visited: Set<string> = new Set()
  ): boolean {
    // Если стартовая нода совпадает с целевой, это цикл
    if (startNodeUuid === targetNodeUuid) {
      return true;
    }

    // Если мы уже посещали эту ноду, пропускаем (избегаем бесконечной рекурсии)
    if (visited.has(startNodeUuid)) {
      return false;
    }

    // Добавляем текущую ноду в посещенные
    visited.add(startNodeUuid);

    // Находим все выходные пины стартовой ноды указанного типа
    const startNodeOutputPins = Object.values(this.pinInstances).filter(
      (pin) => pin.nodeUuid === startNodeUuid && pin.type === outputPinType
    );

    // Для каждого выходного пина проверяем, куда он ведет
    for (const outputPin of startNodeOutputPins) {
      // Находим все провода, идущие от этого пина
      const outgoingWires = this.wires.filter(
        (wire) => wire.from === outputPin.uuid
      );

      for (const wire of outgoingWires) {
        // Находим входной пин, к которому ведет провод
        const inputPin = this.pinInstances[wire.to];
        if (!inputPin || inputPin.type !== inputPinType) {
          continue;
        }

        // Находим ноду, содержащую этот входной пин
        const nextNodeUuid = inputPin.nodeUuid;

        // Если мы достигли целевой ноды, это цикл
        if (nextNodeUuid === targetNodeUuid) {
          return true;
        }

        // Рекурсивно проверяем дальше
        if (
          this.wouldCreateCycle(
            nextNodeUuid,
            targetNodeUuid,
            outputPinType,
            inputPinType,
            visited
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  getPinUuid(
    nodeInstance: { uuid: string },
    pinName: string,
    pinType: PinInstanceType
  ): string | undefined {
    for (const pinInstance of Object.values(this.pinInstances)) {
      if (
        pinInstance.nodeUuid === nodeInstance.uuid &&
        pinInstance.name === pinName &&
        pinInstance.type === pinType
      ) {
        return pinInstance.uuid;
      }
    }
    return undefined;
  }
}

// TODO функция выгрузки текущего инстанса
// TODO функция создания инстанса из выгрузки
// TODO доделать проверку циклических связей в графах
