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
  // Единый индекс для быстрого доступа ко всем нодам
  private nodeInstances: Map<string, AbstractNodeInstance<string>> = new Map();
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

    // Восстанавливаем все ноды в единый индекс
    for (const eventInstance of snapshot.events) {
      this.nodeInstances.set(eventInstance.uuid, { ...eventInstance });
    }
    for (const refInstance of snapshot.refs) {
      this.nodeInstances.set(refInstance.uuid, { ...refInstance });
    }
    for (const pureFunctionInstance of snapshot.pureFunctions) {
      this.nodeInstances.set(pureFunctionInstance.uuid, { ...pureFunctionInstance });
    }
    for (const functionInstance of snapshot.functions) {
      this.nodeInstances.set(functionInstance.uuid, { ...functionInstance });
    }
    this.pinInstances = new Map(
      snapshot.pinInstances.map((pinInstance) => {
        // Если в снапшоте нет dataType, инициализируем из статической конфигурации
        if (!pinInstance.dataType) {
          const nodeInstance = this.getNodeInstance(pinInstance.nodeUuid);

          if (!nodeInstance) {
            throw new CommutatorError(`Node instance for pin "${pinInstance.name}" not found`);
          }

          const nodeConfig = this.getNodeConfig(pinInstance.nodeUuid);

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
    const allNodeInstances = this.getAllNodeInstances();

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

  /**
   * Получает экземпляр ноды по UUID
   */
  private getNodeInstance(uuid: string): AbstractNodeInstance<string> | undefined {
    return this.nodeInstances.get(uuid);
  }

  /**
   * Получает конфигурацию ноды по UUID ноды
   */
  private getNodeConfig(
    nodeUuid: string,
  ):
    | EventNode<DataTypes, any, any, any, any, any, any, any>
    | RefNode<DataTypes, any, any, any, any, any, any, any>
    | PureFunctionNode<DataTypes, any, any, any, any, any, any, any>
    | FunctionNode<DataTypes, any, any, any, any, any, any, any>
    | undefined {
    const nodeInstance = this.getNodeInstance(nodeUuid);
    if (!nodeInstance) {
      return undefined;
    }
    return this.config.getNodeConfigByName(nodeInstance.name);
  }

  /**
   * Получает все экземпляры нод
   */
  private getAllNodeInstances(): AbstractNodeInstance<string>[] {
    return Array.from(this.nodeInstances.values());
  }

  /**
   * Внутренний helper метод для создания ноды
   * Выполняет общую логику создания ноды: валидацию, создание экземпляра, сохранение, создание пинов и вызов callback'ов
   */
  private createNodeInternal<
    NodeInstanceType,
    NodeConfigType extends
      | EventNode<DataTypes, any, any, any, any, any, any, any>
      | RefNode<DataTypes, any, any, any, any, any, any, any>
      | PureFunctionNode<DataTypes, any, any, any, any, any, any, any>
      | FunctionNode<DataTypes, any, any, any, any, any, any, any>,
  >(
    nodeType: NodeType,
    name: string,
    config: unknown,
    nodeConfig: NodeConfigType | undefined,
  ): NodeInstanceType {
    if (!nodeConfig) {
      throw new CommutatorError(`Config for "${String(name)}" not found`);
    }

    if (
      nodeConfig.config &&
      config !== undefined &&
      !this.validator.validateFieldValue(nodeConfig.config, config)
    ) {
      throw new CommutatorError(`Invalid config for ${nodeConfig.type} "${String(name)}"`);
    }

    const nodeInstance = {
      uuid: ulid(),
      type: nodeType,
      name,
      x: 0,
      y: 0,
      config,
    } as NodeInstanceType;

    const nodeInstanceWithUuid = nodeInstance as NodeInstanceType & { uuid: string };
    this.nodeInstances.set(nodeInstanceWithUuid.uuid, nodeInstance as AbstractNodeInstance<string>);
    this.createPinInstances(
      nodeInstanceWithUuid.uuid,
      (nodeConfig.pinsIn as Record<string, Field<DataTypes>>) || {},
      (nodeConfig.pinsOut as Record<string, Field<DataTypes>>) || {},
      (nodeConfig.execPinsIn as Record<string, null>) || {},
      (nodeConfig.execPinsOut as Record<string, null>) || {},
    );

    // Вызываем onConfigChange callback (если есть)
    if (nodeConfig.onConfigChange) {
      nodeConfig.onConfigChange({
        config,
        apis: this.config.apis,
        actions: this.createNodeCallbackActions(nodeInstanceWithUuid.uuid, nodeConfig),
      });
    }

    return nodeInstance;
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
    const eventInstance = this.createNodeInternal<EventNodeInstance<Name>, typeof eventConfig>(
      NodeType.Event,
      name as string,
      config,
      eventConfig,
    );
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
    const refInstance = this.createNodeInternal<RefNodeInstance<Name>, typeof refConfig>(
      NodeType.Ref,
      name as string,
      config,
      refConfig,
    );
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
    const pureFunctionInstance = this.createNodeInternal<
      PureFunctionNodeInstance<Name>,
      typeof pureFunctionConfig
    >(NodeType.PureFunction, name as string, config, pureFunctionConfig);
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
    const functionInstance = this.createNodeInternal<
      FunctionNodeInstance<Name>,
      typeof functionConfig
    >(NodeType.Function, name as string, config, functionConfig);
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
    const outputNodeInstance = this.getNodeInstance(outputPin.nodeUuid);
    const inputNodeInstance = this.getNodeInstance(inputPin.nodeUuid);

    if (!outputNodeInstance || !inputNodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    // Получаем конфигурацию нод
    const outputNodeConfig = this.getNodeConfig(outputPin.nodeUuid);
    const inputNodeConfig = this.getNodeConfig(inputPin.nodeUuid);

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
    for (const node of this.getAllNodeInstances()) {
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
    const nodeInstance = this.getNodeInstance(nodeUuid);

    if (!nodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    const nodeConfig = this.getNodeConfig(nodeUuid);

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
   * Внутренний helper метод для добавления пина по типу
   */
  private addPinByType(
    nodeUuid: string,
    pinType: "pinIn" | "pinOut" | "execPinIn" | "execPinOut",
  ): void {
    const nodeInstance = this.getNodeInstance(nodeUuid);

    if (!nodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    const nodeConfig = this.getNodeConfig(nodeUuid);

    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    const callbackMap = {
      pinIn: nodeConfig.addPinIn,
      pinOut: nodeConfig.addPinOut,
      execPinIn: nodeConfig.addExecPinIn,
      execPinOut: nodeConfig.addExecPinOut,
    } as const;

    const callback = callbackMap[pinType];

    if (callback === undefined) {
      throw new CommutatorError("Cannot add pin to node");
    }

    callback({
      config: nodeInstance.config,
      apis: this.config.apis,
      actions: this.createNodeCallbackActions(nodeUuid, nodeConfig),
    });
  }

  /**
   * Добавление входного data-пина к ноде
   * Вызывает колбек addPinIn из конфигурации ноды
   */
  addPinIn(nodeUuid: string): void {
    this.addPinByType(nodeUuid, "pinIn");
  }

  /**
   * Добавление выходного data-пина к ноде
   * Вызывает колбек addPinOut из конфигурации ноды
   */
  addPinOut(nodeUuid: string): void {
    this.addPinByType(nodeUuid, "pinOut");
  }

  /**
   * Добавление входного exec-пина к ноде
   * Вызывает колбек addExecPinIn из конфигурации ноды
   */
  addExecPinIn(nodeUuid: string): void {
    this.addPinByType(nodeUuid, "execPinIn");
  }

  /**
   * Добавление выходного exec-пина к ноде
   * Вызывает колбек addExecPinOut из конфигурации ноды
   */
  addExecPinOut(nodeUuid: string): void {
    this.addPinByType(nodeUuid, "execPinOut");
  }

  removePin(uuid: string): void {
    const currentPin = this.pinInstances.get(uuid);

    if (!currentPin) {
      throw new CommutatorError("Pin instance not found");
    }

    const pinNodeInstance = this.getNodeInstance(currentPin.nodeUuid);

    if (!pinNodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    const pinNodeConfig = this.getNodeConfig(currentPin.nodeUuid);

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
    const nodeInstance = this.getNodeInstance(uuid);
    if (!nodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    const updatedNode = { ...nodeInstance, x, y };
    this.nodeInstances.set(uuid, updatedNode);
  }

  /**
   * Обновляет конфигурацию ноды. Вызывает onConfigChange callback, если он определен.
   */
  updateNodeConfig(uuid: string, config: unknown): void {
    const nodeInstance = this.getNodeInstance(uuid);

    if (!nodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    // Получаем конфигурацию ноды
    const nodeConfig = this.getNodeConfig(uuid);

    if (!nodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Используем валидатор для проверки обновления конфига
    this.validator.validateUpdateNodeConfig(nodeConfig, config);

    // Обновляем config в nodeInstances
    const updatedNode = { ...nodeInstance, config };
    this.nodeInstances.set(uuid, updatedNode);

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
    const refs: RefNodeInstance<any>[] = [];
    const pureFunctions: PureFunctionNodeInstance<any>[] = [];
    const functions: FunctionNodeInstance<any>[] = [];

    for (const node of this.nodeInstances.values()) {
      switch (node.type) {
        case NodeType.Event:
          events.push(node as EventNodeInstance<any>);
          break;
        case NodeType.Ref:
          refs.push(node as RefNodeInstance<any>);
          break;
        case NodeType.PureFunction:
          pureFunctions.push(node as PureFunctionNodeInstance<any>);
          break;
        case NodeType.Function:
          functions.push(node as FunctionNodeInstance<any>);
          break;
      }
    }

    return {
      events: events.map((event) => ({ ...event })),
      refs: refs.map((ref) => ({ ...ref })),
      pureFunctions: pureFunctions.map((pureFunc) => ({ ...pureFunc })),
      functions: functions.map((func) => ({ ...func })),
      pinInstances: Array.from(this.pinInstances.values()).map((pin) => ({ ...pin })),
      wires: this.wires.map((wire) => ({ ...wire })),
    };
  }
}
