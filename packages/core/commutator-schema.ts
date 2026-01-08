import { CommutatorError } from "./commutator-error";
import { CommutatorValidator } from "./commutator-validator";
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
  NodeCallbackActions,
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
  const Events extends Record<string, EventNode<DataTypes, any, any, any, any, any, any, any>> = {},
  const Refs extends Record<string, RefNode<DataTypes, any, any, any, any, any, any, any>> = {},
  const PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, any, any, any, any, any, any, any>
  > = {},
  const Functions extends Record<
    string,
    FunctionNode<DataTypes, any, any, any, any, any, any, any>
  > = {},
  const Apis extends Record<string, any> = {},
> {
  private eventInstances: Map<string, EventNodeInstance<any>> = new Map();
  private refInstances: Map<string, RefNodeInstance<any>> = new Map();
  private pureFunctionInstances: Map<string, PureFunctionNodeInstance<any>> = new Map();
  private functionInstances: Map<string, FunctionNodeInstance<any>> = new Map();
  private pinInstances: Map<string, PinInstance> = new Map();
  private wires: Wire[] = [];
  private validator: CommutatorValidator<DataTypes>;

  private constructor(
    private dataTypes: DataTypes,
    private events: Events,
    private refs: Refs,
    private pureFunctions: PureFunctions,
    private functions: Functions,
    private apis: Apis,
    snapshot?: CommutatorInstanceSnapshot,
  ) {
    this.validator = new CommutatorValidator(dataTypes);

    if (!snapshot) {
      return;
    }

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
      snapshot.pinInstances.map((pinInstance) => {
        // Если в снапшоте нет pinType, инициализируем из статической конфигурации
        if (!pinInstance.pinType) {
          const nodeInstance =
            this.eventInstances.get(pinInstance.nodeUuid) ||
            this.refInstances.get(pinInstance.nodeUuid) ||
            this.pureFunctionInstances.get(pinInstance.nodeUuid) ||
            this.functionInstances.get(pinInstance.nodeUuid);

          if (!nodeInstance) {
            throw new CommutatorError(`Node instance for pin "${pinInstance.name}" not found`);
          }

          const nodeConfig =
            this.events[nodeInstance.name as keyof Events] ||
            this.refs[nodeInstance.name as keyof Refs] ||
            this.pureFunctions[nodeInstance.name as keyof PureFunctions] ||
            this.functions[nodeInstance.name as keyof Functions];

          if (!nodeConfig) {
            throw new CommutatorError(
              `Node config for pin "${pinInstance.name}" of node "${nodeInstance.name}" not found`,
            );
          }

          const pinConfig = (
            pinInstance.type === PinInstanceType.Input ||
            pinInstance.type === PinInstanceType.InputExec
              ? nodeConfig.pinsIn
              : nodeConfig.pinsOut
          )?.[pinInstance.name];

          const pinType: Pin<DataTypes>["type"] =
            pinInstance.type === PinInstanceType.InputExec ||
            pinInstance.type === PinInstanceType.OutputExec
              ? CommonDataType.Any
              : (((pinConfig as Pin<DataTypes> | undefined)?.type ??
                  CommonDataType.Any) as Pin<DataTypes>["type"]);

          return [pinInstance.uuid, { ...pinInstance, pinType }];
        }

        return [pinInstance.uuid, { ...pinInstance }];
      }),
    );
    this.wires = snapshot.wires.map((wire) => ({ ...wire }));

    // После восстановления всех пинов, вызываем onConfigChange для всех нод (если есть callback'и)
    const allNodeInstances: Array<AbstractNodeInstance<string>> = [
      ...this.eventInstances.values(),
      ...this.refInstances.values(),
      ...this.pureFunctionInstances.values(),
      ...this.functionInstances.values(),
    ];

    for (const nodeInstance of allNodeInstances) {
      const nodeConfig =
        this.events[nodeInstance.name as keyof Events] ||
        this.refs[nodeInstance.name as keyof Refs] ||
        this.pureFunctions[nodeInstance.name as keyof PureFunctions] ||
        this.functions[nodeInstance.name as keyof Functions];

      if (nodeConfig?.onConfigChange) {
        nodeConfig.onConfigChange({
          config: nodeInstance.config,
          apis: this.apis,
          actions: this.createNodeCallbackActions(nodeInstance.uuid, nodeConfig),
        });
      }
    }
  }

  static initialize<
    const DataTypes extends Record<string, Field<DataTypes>> = {},
    const Events extends Record<
      string,
      EventNode<DataTypes, any, any, any, any, any, any, any>
    > = {},
    const Refs extends Record<string, RefNode<DataTypes, any, any, any, any, any, any, any>> = {},
    const PureFunctions extends Record<
      string,
      PureFunctionNode<DataTypes, any, any, any, any, any, any, any>
    > = {},
    const Functions extends Record<
      string,
      FunctionNode<DataTypes, any, any, any, any, any, any, any>
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
    ] as const) {
      for (const [pinName] of Object.entries(pins)) {
        let pinType: Pin<DataTypes>["type"] = CommonDataType.Any;

        if (type === PinInstanceType.Input || type === PinInstanceType.Output) {
          const pinConfigType = pins[pinName as keyof typeof pins]?.type;

          if (pinConfigType) {
            pinType = pinConfigType;
          }
        }

        const pinInstance: PinInstance<DataTypes> = {
          nodeUuid,
          uuid: ulid(),
          type,
          name: pinName,
          pinType,
        };
        this.pinInstances.set(pinInstance.uuid, pinInstance);
      }
    }
  }

  createEvent<Name extends keyof Events>(
    name: Name,
    config?: FieldValue<NonNullable<Events[Name]["config"]>, DataTypes>,
  ): EventNodeInstance<Name> {
    const eventConfig = this.events[name];

    if (!eventConfig) {
      throw new CommutatorError(`Event config for "${String(name)}" not found`);
    }

    if (
      eventConfig.config &&
      config !== undefined &&
      !this.validator.validateFieldValue(eventConfig.config, config)
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

    // Вызываем onConfigChange callback (если есть)
    if (eventConfig.onConfigChange) {
      eventConfig.onConfigChange({
        config,
        apis: this.apis,
        actions: this.createNodeCallbackActions(eventInstance.uuid, eventConfig),
      });
    }

    return { ...eventInstance };
  }

  createRef<Name extends keyof Refs>(
    name: Name,
    config?: FieldValue<NonNullable<Refs[Name]["config"]>, DataTypes>,
  ): RefNodeInstance<Name> {
    const refConfig = this.refs[name];

    if (!refConfig) {
      throw new CommutatorError(`Ref config for "${String(name)}" not found`);
    }

    if (
      refConfig.config &&
      config !== undefined &&
      !this.validator.validateFieldValue(refConfig.config, config)
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

    // Вызываем onConfigChange callback (если есть)
    if (refConfig.onConfigChange) {
      refConfig.onConfigChange({
        config,
        apis: this.apis,
        actions: this.createNodeCallbackActions(refInstance.uuid, refConfig),
      });
    }

    return { ...refInstance };
  }

  createPureFunction<Name extends keyof PureFunctions>(
    name: Name,
    config?: FieldValue<NonNullable<PureFunctions[Name]["config"]>, DataTypes>,
  ): PureFunctionNodeInstance<Name> {
    const pureFunctionConfig = this.pureFunctions[name];

    if (!pureFunctionConfig) {
      throw new CommutatorError(`Pure function config for "${String(name)}" not found`);
    }

    if (
      pureFunctionConfig.config &&
      config !== undefined &&
      !this.validator.validateFieldValue(pureFunctionConfig.config, config)
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

    // Вызываем onConfigChange callback (если есть)
    if (pureFunctionConfig.onConfigChange) {
      pureFunctionConfig.onConfigChange({
        config,
        apis: this.apis,
        actions: this.createNodeCallbackActions(pureFunctionInstance.uuid, pureFunctionConfig),
      });
    }

    return { ...pureFunctionInstance };
  }

  createFunction<Name extends keyof Functions>(
    name: Name,
    config?: FieldValue<NonNullable<Functions[Name]["config"]>, DataTypes>,
  ): FunctionNodeInstance<Name> {
    const functionConfig = this.functions[name];

    if (!functionConfig) {
      throw new CommutatorError(`Function config for "${String(name)}" not found`);
    }

    if (
      functionConfig.config &&
      config !== undefined &&
      !this.validator.validateFieldValue(functionConfig.config, config)
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

    // Вызываем onConfigChange callback (если есть)
    if (functionConfig.onConfigChange) {
      functionConfig.onConfigChange({
        config,
        apis: this.apis,
        actions: this.createNodeCallbackActions(functionInstance.uuid, functionConfig),
      });
    }

    return { ...functionInstance };
  }

  private createNodeCallbackActions(
    nodeUuid: string,
    nodeConfig:
      | EventNode<DataTypes, any, any, any, any, any, any, any>
      | RefNode<DataTypes, any, any, any, any, any, any, any>
      | PureFunctionNode<DataTypes, any, any, any, any, any, any, any>
      | FunctionNode<DataTypes, any, any, any, any, any, any, any>,
  ): NodeCallbackActions<DataTypes> {
    return {
      updatePin: (name: string, args: { name?: string; pinType?: Pin<DataTypes>["type"] }) => {
        const pin = this.getPinByName(nodeUuid, name);
        if (!pin) {
          throw new CommutatorError(`Pin "${name}" not found`);
        }
        if (args.pinType !== undefined) {
          pin.pinType = args.pinType;
        }
        if (args.name !== undefined && args.name !== name) {
          // Проверяем, что новое имя не занято
          const existingPin = this.getPinByName(nodeUuid, args.name);
          if (existingPin && existingPin.uuid !== pin.uuid) {
            throw new CommutatorError(`Pin with name "${args.name}" already exists`);
          }
          // Обновляем имя пина
          pin.name = args.name;
        }
      },
      addPin: (name: string, type: PinInstanceType, pinType: Pin<DataTypes>["type"]) => {
        // Переиспользуем существующий метод addPin
        this.addPin(nodeUuid, name, type, pinType);
      },
      removePin: (name: string) => {
        // Находим пин по имени и используем существующий метод removePin
        const pin = this.getPinByName(nodeUuid, name);
        if (!pin) {
          throw new CommutatorError(`Pin "${name}" not found`);
        }
        this.removePin(pin.uuid);
      },
      resetPins: () => {
        // Получаем все пины из конфигурации
        const configPins = new Map<
          string,
          { type: PinInstanceType; pinType: Pin<DataTypes>["type"] }
        >();

        // Собираем пины из конфигурации
        for (const [pinName, pinConfig] of Object.entries<Pin<DataTypes>>(
          nodeConfig.pinsIn || {},
        )) {
          configPins.set(pinName, {
            type: PinInstanceType.Input,
            pinType: pinConfig.type,
          });
        }
        for (const [pinName, pinConfig] of Object.entries<Pin<DataTypes>>(
          nodeConfig.pinsOut || {},
        )) {
          configPins.set(pinName, {
            type: PinInstanceType.Output,
            pinType: pinConfig.type,
          });
        }
        for (const pinName of Object.keys(nodeConfig.execPinsIn || {})) {
          configPins.set(pinName, {
            type: PinInstanceType.InputExec,
            pinType: CommonDataType.Any,
          });
        }
        for (const pinName of Object.keys(nodeConfig.execPinsOut || {})) {
          configPins.set(pinName, {
            type: PinInstanceType.OutputExec,
            pinType: CommonDataType.Any,
          });
        }

        // Получаем все текущие пины ноды
        const currentPins = [...this.pinInstances.values()].filter((p) => p.nodeUuid === nodeUuid);
        const currentPinsMap = new Map<string, PinInstance<DataTypes>>();
        for (const pin of currentPins) {
          currentPinsMap.set(pin.name, pin);
        }

        // Обрабатываем существующие пины: удаляем или обновляем
        for (const pin of currentPins) {
          const configPin = configPins.get(pin.name);

          if (!configPin) {
            // Пина нет в конфигурации - удаляем
            this.wires = this.wires.filter(
              (wire) => wire.from !== pin.uuid && wire.to !== pin.uuid,
            );
            this.pinInstances.delete(pin.uuid);
            currentPinsMap.delete(pin.name);
          } else if (configPin.type !== pin.type) {
            // Тип пина не совпадает с конфигурацией - удаляем старый пин
            // Новый будет создан в следующем цикле
            this.wires = this.wires.filter(
              (wire) => wire.from !== pin.uuid && wire.to !== pin.uuid,
            );
            this.pinInstances.delete(pin.uuid);
            currentPinsMap.delete(pin.name);
          } else {
            // Пин существует и тип совпадает - обновляем только pinType
            pin.pinType = configPin.pinType;
          }
        }

        // Создаем новые пины из конфигурации, которых нет в инстансах
        for (const [pinName, configPin] of configPins.entries()) {
          const existingPin = currentPinsMap.get(pinName);

          // Если пина нет или он был удален из-за несовпадения типа - создаем новый
          if (!existingPin) {
            // Проверяем флаги canAddPin*
            if (
              (configPin.type === PinInstanceType.Input && !nodeConfig.canAddPinIn) ||
              (configPin.type === PinInstanceType.Output && !nodeConfig.canAddPinOut) ||
              (configPin.type === PinInstanceType.InputExec && !nodeConfig.canAddExecPinIn) ||
              (configPin.type === PinInstanceType.OutputExec && !nodeConfig.canAddExecPinOut)
            ) {
              // Если нельзя добавлять пины, пропускаем
              continue;
            }
            // Создаем новый пин
            const pinInstance: PinInstance<DataTypes> = {
              nodeUuid,
              uuid: ulid(),
              type: configPin.type,
              name: pinName,
              pinType: configPin.pinType,
            };
            this.pinInstances.set(pinInstance.uuid, pinInstance);
          }
        }
      },
      getPin: (name: string) => {
        return this.getPinByName(nodeUuid, name);
      },
      getAllPins: () => {
        // Переиспользуем существующий метод getNodePins
        return this.getNodePins(nodeUuid);
      },
      isWired: (name: string) => {
        const pin = this.getPinByName(nodeUuid, name);
        if (!pin) {
          return false;
        }
        return this.wires.some((wire) => wire.from === pin.uuid || wire.to === pin.uuid);
      },
      getWiredNode: (name: string) => {
        const pin = this.getPinByName(nodeUuid, name);
        if (!pin) {
          return undefined;
        }
        const wire = this.wires.find((w) => w.from === pin.uuid || w.to === pin.uuid);
        if (!wire) {
          return undefined;
        }
        const connectedPinUuid = wire.from === pin.uuid ? wire.to : wire.from;
        const connectedPin = this.pinInstances.get(connectedPinUuid);
        if (!connectedPin) {
          return undefined;
        }
        return connectedPin;
      },
      getPinConfig: (name: string) => {
        const pin = this.getPinByName(nodeUuid, name);
        if (!pin) {
          return undefined;
        }
        const pinConfig = (
          pin.type === PinInstanceType.Input || pin.type === PinInstanceType.InputExec
            ? nodeConfig.pinsIn
            : nodeConfig.pinsOut
        )?.[pin.name];
        return pinConfig;
      },
    };
  }

  private getPinByName(nodeUuid: string, pinName: string): PinInstance<DataTypes> | undefined {
    return [...this.pinInstances.values()].find(
      (pin) => pin.nodeUuid === nodeUuid && pin.name === pinName,
    );
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
    let outputPin: PinInstance<DataTypes>;
    let inputPin: PinInstance<DataTypes>;
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

    // Получаем пины для валидации
    const updatedOutputPin = this.pinInstances.get(outputPinUuid);
    const updatedInputPin = this.pinInstances.get(inputPinUuid);

    if (!updatedOutputPin || !updatedInputPin) {
      throw new CommutatorError("Pin not found after callback");
    }

    // Проверяем типы для data pins
    if (
      updatedOutputPin.type === PinInstanceType.Output &&
      updatedInputPin.type === PinInstanceType.Input
    ) {
      // Проверяем совместимость типов используя pinType из PinInstance
      // Если inputPin имеет тип Any, то принимает любой тип
      if (updatedInputPin.pinType !== CommonDataType.Any) {
        if (updatedOutputPin.pinType !== updatedInputPin.pinType) {
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
    if (this.checkCyclicConnection(updatedOutputPin, updatedInputPin)) {
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
    const fromPin = this.pinInstances.get(from);
    const toPin = this.pinInstances.get(to);

    if (!fromPin || !toPin) {
      // Если пины не найдены, просто удаляем провод (идемпотентность)
      this.wires = this.wires.filter(
        (wire) => (wire.from !== from && wire.to !== to) || (wire.from !== to && wire.to !== from),
      );
      return;
    }

    // Удаляем провод
    this.wires = this.wires.filter(
      (wire) => (wire.from !== from && wire.to !== to) || (wire.from !== to && wire.to !== from),
    );
  }

  /**
   * Добавление пина в ноду. Выдаст ошибку, если в настройках ноды запрещено добавлять пины данного типа
   */
  addPin(
    nodeUuid: string,
    name: string,
    type: PinInstanceType,
    pinType?: Pin<DataTypes>["type"],
  ): void {
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

    // Получаем тип пина из конфигурации ноды, если не передан явно
    let finalPinType: Pin<DataTypes>["type"];
    if (pinType !== undefined) {
      finalPinType = pinType;
    } else {
      const pinConfig = (
        type === PinInstanceType.Input || type === PinInstanceType.InputExec
          ? nodeConfig.pinsIn
          : nodeConfig.pinsOut
      )?.[name];

      finalPinType =
        type === PinInstanceType.InputExec || type === PinInstanceType.OutputExec
          ? (CommonDataType.Any as Pin<DataTypes>["type"])
          : ((pinConfig as Pin<DataTypes> | undefined)?.type ??
            (CommonDataType.Any as Pin<DataTypes>["type"]));
    }

    const pinInstance: PinInstance<DataTypes> = {
      nodeUuid,
      uuid: ulid(),
      type,
      name,
      pinType: finalPinType,
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

    // Удаляем все провода, подключенные к этому пину
    this.wires = this.wires.filter((wire) => wire.from !== uuid && wire.to !== uuid);

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
   * Обновляет конфигурацию ноды. Вызывает onConfigChange callback, если он определен.
   */
  updateNodeConfig(uuid: string, config: unknown): void {
    const nodeInstance =
      this.eventInstances.get(uuid) ||
      this.refInstances.get(uuid) ||
      this.pureFunctionInstances.get(uuid) ||
      this.functionInstances.get(uuid);

    if (!nodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    // Получаем конфигурацию ноды
    const nodeConfig =
      this.events[nodeInstance.name as keyof Events] ||
      this.refs[nodeInstance.name as keyof Refs] ||
      this.pureFunctions[nodeInstance.name as keyof PureFunctions] ||
      this.functions[nodeInstance.name as keyof Functions];

    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Валидируем новый config
    if (
      nodeConfig.config &&
      config !== undefined &&
      !this.validator.validateFieldValue(nodeConfig.config, config)
    ) {
      throw new CommutatorError(`Invalid config for node "${nodeInstance.name}"`);
    }

    // Обновляем config в соответствующем Map
    switch (nodeInstance.type) {
      case NodeType.Event:
        this.eventInstances.set(uuid, { ...nodeInstance, config });
        break;
      case NodeType.Ref:
        this.refInstances.set(uuid, { ...nodeInstance, config });
        break;
      case NodeType.PureFunction:
        this.pureFunctionInstances.set(uuid, { ...nodeInstance, config });
        break;
      case NodeType.Function:
        this.functionInstances.set(uuid, { ...nodeInstance, config });
        break;
      default:
        throw new CommutatorError("Unknown node type");
    }

    // Вызываем onConfigChange callback (если есть)
    if (nodeConfig.onConfigChange) {
      nodeConfig.onConfigChange({
        config,
        apis: this.apis,
        actions: this.createNodeCallbackActions(uuid, nodeConfig),
      });
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

  getNodePins(nodeUuid: string): PinInstance<DataTypes>[] {
    const result: PinInstance<DataTypes>[] = [];
    for (const pinInstance of this.pinInstances.values()) {
      if (pinInstance.nodeUuid === nodeUuid) {
        result.push({ ...pinInstance } as PinInstance<DataTypes>);
      }
    }
    return result;
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
