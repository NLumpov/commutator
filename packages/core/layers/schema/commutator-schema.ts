import { ulid } from "../../util/ulid";
import {
  CommonDataType,
  type CommutatorConfig,
  CommutatorError,
  CommutatorValidator,
  type EventNode,
  type Field,
  type FieldValue,
  type FunctionNode,
  type NodeCallbackActions,
  NodeType,
  type PureFunctionNode,
  type RefNode,
} from "../commutator";
import { PinInstanceType } from "./enums";
import { FluentNodeBuilder } from "./fluent-node-builder";
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
        // Если в снапшоте нет dataType, инициализируем из статической конфигурации
        if (!pinInstance.dataType) {
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

          const pinConfig: Field<DataTypes> = (
            pinInstance.type === PinInstanceType.Input ||
            pinInstance.type === PinInstanceType.InputExec
              ? nodeConfig.pinsIn
              : nodeConfig.pinsOut
          )?.[pinInstance.name];

          const dataType: Field<DataTypes> =
            pinInstance.type === PinInstanceType.InputExec ||
            pinInstance.type === PinInstanceType.OutputExec
              ? { type: CommonDataType.Any }
              : (pinConfig ?? { type: CommonDataType.Any });

          return [pinInstance.uuid, { ...pinInstance, dataType }];
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
      const validator = new CommutatorValidator(config.dataTypes);
      validator.validateSnapshot(snapshot, config);
    }

    return new CommutatorSchema(config, snapshot);
  }

  private createPinInstances(
    nodeUuid: string,
    pinsIn: Record<string, Field<DataTypes>>,
    pinsOut: Record<string, Field<DataTypes>>,
    execPinsIn: Record<string, null>,
    execPinsOut: Record<string, null>,
  ): void {
    for (const { pins, type } of [
      { pins: pinsIn, type: PinInstanceType.Input },
      { pins: pinsOut, type: PinInstanceType.Output },
      { pins: execPinsIn, type: PinInstanceType.InputExec },
      { pins: execPinsOut, type: PinInstanceType.OutputExec },
    ] as const) {
      for (const [pinName] of Object.entries(pins)) {
        let dataType: Field<DataTypes> = { type: CommonDataType.Any };

        if (type === PinInstanceType.Input || type === PinInstanceType.Output) {
          const pinConfigType = pins[pinName as keyof typeof pins];

          if (pinConfigType) {
            dataType = pinConfigType;
          }
        }

        const pinInstance: PinInstance<DataTypes> = {
          nodeUuid,
          uuid: ulid(),
          type,
          name: pinName,
          dataType,
        };
        this.pinInstances.set(pinInstance.uuid, pinInstance);
      }
    }
  }

  createEvent<Name extends keyof Events>(
    name: Name,
    config?: FieldValue<NonNullable<Events[Name]["config"]>, DataTypes>,
  ): FluentNodeBuilder<
    DataTypes,
    Events,
    Refs,
    PureFunctions,
    Functions,
    Apis,
    EventNodeInstance<Name>
  > {
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

    return new FluentNodeBuilder(this, { ...eventInstance });
  }

  createRef<Name extends keyof Refs>(
    name: Name,
    config?: FieldValue<NonNullable<Refs[Name]["config"]>, DataTypes>,
  ): FluentNodeBuilder<
    DataTypes,
    Events,
    Refs,
    PureFunctions,
    Functions,
    Apis,
    RefNodeInstance<Name>
  > {
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

    return new FluentNodeBuilder(this, { ...refInstance });
  }

  createPureFunction<Name extends keyof PureFunctions>(
    name: Name,
    config?: FieldValue<NonNullable<PureFunctions[Name]["config"]>, DataTypes>,
  ): FluentNodeBuilder<
    DataTypes,
    Events,
    Refs,
    PureFunctions,
    Functions,
    Apis,
    PureFunctionNodeInstance<Name>
  > {
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

    return new FluentNodeBuilder(this, { ...pureFunctionInstance });
  }

  createFunction<Name extends keyof Functions>(
    name: Name,
    config?: FieldValue<NonNullable<Functions[Name]["config"]>, DataTypes>,
  ): FluentNodeBuilder<
    DataTypes,
    Events,
    Refs,
    PureFunctions,
    Functions,
    Apis,
    FunctionNodeInstance<Name>
  > {
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

    return new FluentNodeBuilder(this, { ...functionInstance });
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
      addPin: (
        name: string,
        type: PinInstanceType.Input | PinInstanceType.Output,
        dataType: Field<DataTypes>,
      ) => {
        // Переиспользуем существующий метод addPin
        this.addPin(nodeUuid, name, type, dataType);
      },
      addExecPin: (name: string, type: PinInstanceType.InputExec | PinInstanceType.OutputExec) => {
        // Переиспользуем существующий метод addExecPin
        this.addPin(nodeUuid, name, type, null);
      },
      updatePin: (pinUuid: string, args: { name?: string; dataType?: Field<DataTypes> }) => {
        // Переиспользуем существующий метод updatePin
        this.updatePin(pinUuid, args);
      },
      removePin: (pinUuid: string) => {
        // Переиспользуем существующий метод removePin
        this.removePin(pinUuid);
      },
      resetPins: () => {
        // Получаем все пины из конфигурации
        const configPins = new Map<string, Pick<PinInstance<DataTypes>, "type" | "dataType">>();

        // Собираем пины из конфигурации
        for (const [pinName, pinConfig] of Object.entries<Field<DataTypes>>(
          nodeConfig.pinsIn || {},
        )) {
          configPins.set(pinName, {
            type: PinInstanceType.Input,
            dataType: pinConfig,
          });
        }
        for (const [pinName, pinConfig] of Object.entries<Field<DataTypes>>(
          nodeConfig.pinsOut || {},
        )) {
          configPins.set(pinName, {
            type: PinInstanceType.Output,
            dataType: pinConfig,
          });
        }
        for (const pinName of Object.keys(nodeConfig.execPinsIn || {})) {
          configPins.set(pinName, {
            type: PinInstanceType.InputExec,
            dataType: null,
          });
        }
        for (const pinName of Object.keys(nodeConfig.execPinsOut || {})) {
          configPins.set(pinName, {
            type: PinInstanceType.OutputExec,
            dataType: null,
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
            // Пин существует и тип совпадает - обновляем только dataType
            pin.dataType = configPin.dataType;
          }
        }

        // Создаем новые пины из конфигурации, которых нет в инстансах
        for (const [pinName, configPin] of configPins.entries()) {
          const existingPin = currentPinsMap.get(pinName);

          // Если пина нет или он был удален из-за несовпадения типа - создаем новый
          if (!existingPin && configPin.dataType !== undefined) {
            this.addPin(
              nodeUuid,
              pinName,
              configPin.type,
              configPin.type === PinInstanceType.InputExec ||
                configPin.type === PinInstanceType.OutputExec
                ? null
                : configPin.dataType,
            );
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

  /**
   * Подключение пинов
   * Поддерживает два варианта вызова:
   * 1. wire({ from: { node: nodeUuid, pin: pinName }, to: { node: nodeUuid, pin: pinName } }) - именованные параметры
   * 2. wire({ fromPinUuid: string; toPinUuid: string }) - подключение по UUID пинов
   */
  wire(options: { from: { node: string; pin: string }; to: { node: string; pin: string } }): void;
  wire(options: { fromPinUuid: string; toPinUuid: string }): void;
  wire(
    options:
      | { from: { node: string; pin: string }; to: { node: string; pin: string } }
      | { fromPinUuid: string; toPinUuid: string },
  ): void {
    if ("from" in options) {
      const fromPin = this.getPin(options.from.node, options.from.pin);
      const toPin = this.getPin(options.to.node, options.to.pin);

      this.wireInternal(fromPin.uuid, toPin.uuid);

      return;
    }

    this.wireInternal(options.fromPinUuid, options.toPinUuid);
  }

  private wireInternal(from: string, to: string): void {
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
    this.validator.validateWire(
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
   * Отвязка пинов
   * Поддерживает два варианта вызова:
   * 1. unwire({ from: { node: nodeUuid, pin: pinName }, to: { node: nodeUuid, pin: pinName } }) - именованные параметры
   * 2. unwire({ fromPinUuid: string; toPinUuid: string }) - отвязка по UUID пинов
   */
  unwire(options: { from: { node: string; pin: string }; to: { node: string; pin: string } }): void;
  unwire(options: { fromPinUuid: string; toPinUuid: string }): void;
  unwire(
    options:
      | { from: { node: string; pin: string }; to: { node: string; pin: string } }
      | { fromPinUuid: string; toPinUuid: string },
  ): void {
    if ("from" in options) {
      const fromPin = this.getPin(options.from.node, options.from.pin);
      const toPin = this.getPin(options.to.node, options.to.pin);

      this.wires = this.wires.filter(
        (wire) =>
          (wire.from !== fromPin.uuid && wire.to !== toPin.uuid) ||
          (wire.from !== toPin.uuid && wire.to !== fromPin.uuid),
      );

      return;
    }

    // Удаляем провод
    this.wires = this.wires.filter(
      (wire) =>
        (wire.from !== options.fromPinUuid && wire.to !== options.toPinUuid) ||
        (wire.from !== options.toPinUuid && wire.to !== options.fromPinUuid),
    );
  }

  /**
   * Атомарная функция добавления пина в ноду.
   * Не знает про колбеки, просто создает пин.
   */
  private addPin(
    nodeUuid: string,
    name: string,
    type: PinInstanceType,
    dataType: null | Field<DataTypes>,
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

    // Получаем тип пина из конфигурации ноды, если не передан явно
    let finalPinDataType: Field<DataTypes> | null;
    if (dataType !== undefined) {
      finalPinDataType = dataType;
    } else {
      const pinConfig = (
        type === PinInstanceType.Input || type === PinInstanceType.InputExec
          ? nodeConfig.pinsIn
          : nodeConfig.pinsOut
      )?.[name];

      finalPinDataType =
        type === PinInstanceType.InputExec || type === PinInstanceType.OutputExec
          ? { type: CommonDataType.Any }
          : (pinConfig?.type ?? { type: CommonDataType.Any });
    }

    const pinInstance: PinInstance<DataTypes> = {
      nodeUuid,
      uuid: ulid(),
      type,
      name,
      dataType: finalPinDataType,
    };

    this.pinInstances.set(pinInstance.uuid, pinInstance);
  }

  /**
   * Обновление пина в ноде. Позволяет изменить имя и/или тип пина.
   */
  updatePin(pinUuid: string, args: { name?: string; dataType?: Field<DataTypes> }): void {
    const pin = this.pinInstances.get(pinUuid);
    if (!pin) {
      throw new CommutatorError("Pin instance not found");
    }
    if (args.dataType !== undefined) {
      pin.dataType = args.dataType;
    }
    if (args.name !== undefined && args.name !== pin.name) {
      // Проверяем, что новое имя не занято в той же ноде
      const nodePins = this.getNodePins(pin.nodeUuid);
      const existingPin = nodePins.find((p) => p.name === args.name && p.uuid !== pin.uuid);
      if (existingPin) {
        throw new CommutatorError(`Pin with name "${args.name}" already exists`);
      }
      // Обновляем имя пина
      pin.name = args.name;
    }
  }

  /**
   * Добавление входного data-пина к ноде
   * Вызывает колбек addPinIn из конфигурации ноды
   */
  addPinIn(nodeUuid: string): void {
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

    if (nodeConfig.addPinIn === undefined) {
      throw new CommutatorError("Cannot add pin to node");
    }

    nodeConfig.addPinIn({
      config: nodeInstance.config,
      apis: this.config.apis,
      actions: this.createNodeCallbackActions(nodeUuid, nodeConfig),
    });
  }

  /**
   * Добавление выходного data-пина к ноде
   * Вызывает колбек addPinOut из конфигурации ноды
   */
  addPinOut(nodeUuid: string): void {
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

    if (nodeConfig.addPinOut === undefined) {
      throw new CommutatorError("Cannot add pin to node");
    }

    nodeConfig.addPinOut({
      config: nodeInstance.config,
      apis: this.config.apis,
      actions: this.createNodeCallbackActions(nodeUuid, nodeConfig),
    });
  }

  /**
   * Добавление входного exec-пина к ноде
   * Вызывает колбек addExecPinIn из конфигурации ноды
   */
  addExecPinIn(nodeUuid: string): void {
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

    if (nodeConfig.addExecPinIn === undefined) {
      throw new CommutatorError("Cannot add pin to node");
    }

    nodeConfig.addExecPinIn({
      config: nodeInstance.config,
      apis: this.config.apis,
      actions: this.createNodeCallbackActions(nodeUuid, nodeConfig),
    });
  }

  /**
   * Добавление выходного exec-пина к ноде
   * Вызывает колбек addExecPinOut из конфигурации ноды
   */
  addExecPinOut(nodeUuid: string): void {
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

    if (nodeConfig.addExecPinOut === undefined) {
      throw new CommutatorError("Cannot add pin to node");
    }

    nodeConfig.addExecPinOut({
      config: nodeInstance.config,
      apis: this.config.apis,
      actions: this.createNodeCallbackActions(nodeUuid, nodeConfig),
    });
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

    // Проверка наличия колбеков addPin* (используется для удаления тоже)
    if (
      (currentPin.type === PinInstanceType.Input && pinNodeConfig.addPinIn === undefined) ||
      (currentPin.type === PinInstanceType.Output && pinNodeConfig.addPinOut === undefined) ||
      (currentPin.type === PinInstanceType.InputExec && pinNodeConfig.addExecPinIn === undefined) ||
      (currentPin.type === PinInstanceType.OutputExec && pinNodeConfig.addExecPinOut === undefined)
    ) {
      throw new CommutatorError("Cannot remove pin from node");
    }

    // Проверка: нельзя удалить последний пин данного типа
    const nodePins = [...this.pinInstances.values()].filter(
      (p) => p.nodeUuid === currentPin.nodeUuid && p.type === currentPin.type,
    );

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
    const nodeConfig = this.config.getNodeConfigByName(nodeInstance.name);

    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Используем валидатор для проверки обновления конфига
    this.validator.validateUpdateNodeConfig(nodeConfig, config);

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

    if (nodeConfig.onConfigChange) {
      nodeConfig.onConfigChange({
        config,
        apis: this.config.apis,
        actions: this.createNodeCallbackActions(uuid, nodeConfig),
      });
    }
  }

  /**
   * Получение пина по UUID ноды и имени пина
   * @param nodeUuid - UUID ноды
   * @param pinName - Имя пина
   * @returns Экземпляр пина
   * @throws CommutatorError если пин не найден
   */
  getPin(nodeUuid: string, pinName: string): PinInstance<DataTypes> {
    const pin = this.getPinByName(nodeUuid, pinName);
    if (!pin) {
      throw new CommutatorError(`Pin "${pinName}" not found in node "${nodeUuid}"`);
    }
    return { ...pin } as PinInstance<DataTypes>;
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
