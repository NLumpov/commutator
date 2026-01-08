import { ulid } from "../../util/ulid";
import {
  CommonDataType,
  type CommutatorConfig,
  CommutatorError,
  CommutatorValidator,
  type EventNode,
  type ExecPin,
  type Field,
  type FieldValue,
  type FunctionNode,
  type NodeCallbackActions,
  NodeType,
  type Pin,
  type PureFunctionNode,
  type RefNode,
} from "../commutator";
import { PinInstanceType } from "./enums";
import { SchemaValidator } from "./schema-validator";
import type {
  AbstractNodeInstance,
  EventNodeInstance,
  FunctionNodeInstance,
  PinInstance,
  PureFunctionNodeInstance,
  RefNodeInstance,
  SchemaSnapshot,
  Wire,
} from "./types";

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
    private config: CommutatorConfig<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    snapshot?: SchemaSnapshot,
  ) {
    this.validator = new CommutatorValidator(config.dataTypes);

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

          const nodeConfig = this.config.getNodeConfigByName(nodeInstance.name);

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
              : (pinConfig?.type ?? CommonDataType.Any);

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
      const nodeConfig = this.config.getNodeConfigByName(nodeInstance.name);

      if (!nodeConfig) {
        continue;
      }

      if (nodeConfig.onConfigChange) {
        nodeConfig.onConfigChange({
          config: nodeInstance.config,
          apis: this.config.apis,
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
    config: CommutatorConfig<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    snapshot?: SchemaSnapshot,
  ): CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    // КРИТИЧЕСКИ ВАЖНО: Валидация ПЕРВОЙ - ДО создания экземпляра!
    // Невалидный снапшот НЕ ДОЛЖЕН быть пропущен
    if (snapshot) {
      SchemaValidator.validateSnapshot(snapshot, config);
    }

    return new CommutatorSchema(config, snapshot);
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
    const eventConfig = this.config.events[name];

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
        apis: this.config.apis,
        actions: this.createNodeCallbackActions(eventInstance.uuid, eventConfig),
      });
    }

    return { ...eventInstance };
  }

  createRef<Name extends keyof Refs>(
    name: Name,
    config?: FieldValue<NonNullable<Refs[Name]["config"]>, DataTypes>,
  ): RefNodeInstance<Name> {
    const refConfig = this.config.refs[name];

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
        apis: this.config.apis,
        actions: this.createNodeCallbackActions(refInstance.uuid, refConfig),
      });
    }

    return { ...refInstance };
  }

  createPureFunction<Name extends keyof PureFunctions>(
    name: Name,
    config?: FieldValue<NonNullable<PureFunctions[Name]["config"]>, DataTypes>,
  ): PureFunctionNodeInstance<Name> {
    const pureFunctionConfig = this.config.pureFunctions[name];

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
        config: config,
        apis: this.config.apis,
        actions: this.createNodeCallbackActions(pureFunctionInstance.uuid, pureFunctionConfig),
      });
    }

    return { ...pureFunctionInstance };
  }

  createFunction<Name extends keyof Functions>(
    name: Name,
    config?: FieldValue<NonNullable<Functions[Name]["config"]>, DataTypes>,
  ): FunctionNodeInstance<Name> {
    const functionConfig = this.config.functions[name];

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
        config: config,
        apis: this.config.apis,
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
    const outputNodeConfig = this.config.getNodeConfigByName(outputNodeInstance.name);
    const inputNodeConfig = this.config.getNodeConfigByName(inputNodeInstance.name);

    if (!outputNodeConfig || !inputNodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Получаем пины для валидации (после возможных callback'ов)
    const updatedOutputPin = this.pinInstances.get(outputPinUuid);
    const updatedInputPin = this.pinInstances.get(inputPinUuid);

    if (!updatedOutputPin || !updatedInputPin) {
      throw new CommutatorError("Pin not found after callback");
    }

    // Создаем Map всех нод для валидатора
    const allNodesMap = new Map<string, AbstractNodeInstance<string>>();
    for (const node of [
      ...this.eventInstances.values(),
      ...this.refInstances.values(),
      ...this.pureFunctionInstances.values(),
      ...this.functionInstances.values(),
    ]) {
      allNodesMap.set(node.uuid, node);
    }

    // Используем валидатор для проверки провода
    SchemaValidator.validateWire(
      updatedOutputPin,
      updatedInputPin,
      this.wires,
      this.pinInstances,
      allNodesMap,
      this.config,
    );

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

    const nodeConfig = this.config.getNodeConfigByName(nodeInstance.name);

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
          ? CommonDataType.Any
          : (pinConfig?.type ?? CommonDataType.Any);
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

    const pinNodeConfig = this.config.getNodeConfigByName(pinNodeInstance.name);

    if (!pinNodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Используем валидатор для проверки удаления пина
    SchemaValidator.validateRemovePin(currentPin, pinNodeConfig, this.pinInstances);

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
    const nodeConfig = this.config.getNodeConfigByName(nodeInstance.name);

    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Используем валидатор для проверки обновления конфига
    SchemaValidator.validateUpdateNodeConfig(nodeConfig, config, this.validator);

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
    const configWithCallback = nodeConfig as {
      onConfigChange?: (args: {
        config: unknown;
        apis: any;
        actions: NodeCallbackActions<DataTypes>;
      }) => void;
    };

    if (configWithCallback.onConfigChange) {
      configWithCallback.onConfigChange({
        config,
        apis: this.config.apis,
        actions: this.createNodeCallbackActions(uuid, nodeConfig),
      });
    }
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

  extract(): SchemaSnapshot {
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
