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
import { NodesRegistry } from "./nodes-registry";
import { PinsRegistry } from "./pins-registry";
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
import { WiresRegistry } from "./wires-registry";

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
  private nodesRegistry: NodesRegistry;
  private pinsRegistry: PinsRegistry<DataTypes>;
  private wiresRegistry: WiresRegistry<DataTypes>;
  private validator: CommutatorValidator<DataTypes>;

  private constructor(
    private config: CommutatorConfig<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    snapshot?: SchemaSnapshot,
  ) {
    this.validator = new CommutatorValidator(config.dataTypes);

    if (!snapshot) {
      this.nodesRegistry = new NodesRegistry<DataTypes>([], config, this.validator);
      this.pinsRegistry = new PinsRegistry<DataTypes>([], this.nodesRegistry, this.validator);
      this.wiresRegistry = new WiresRegistry(
        [],
        this.pinsRegistry,
        this.nodesRegistry,
        this.validator,
      );
      return;
    }

    if (!snapshot) {
      throw new CommutatorError("Snapshot is null or undefined");
    }

    if (!Array.isArray(snapshot.nodes)) {
      throw new CommutatorError("Snapshot.nodes must be an array");
    }

    if (!Array.isArray(snapshot.pinInstances)) {
      throw new CommutatorError("Snapshot.pinInstances must be an array");
    }

    if (!Array.isArray(snapshot.wires)) {
      throw new CommutatorError("Snapshot.wires must be an array");
    }

    // Восстанавливаем все сущности в реестры
    this.nodesRegistry = new NodesRegistry<DataTypes>(snapshot.nodes, config, this.validator);
    this.pinsRegistry = new PinsRegistry<DataTypes>(
      snapshot.pinInstances,
      this.nodesRegistry,
      this.validator,
    );
    this.wiresRegistry = new WiresRegistry(
      snapshot.wires,
      this.pinsRegistry,
      this.nodesRegistry,
      this.validator,
    );

    this.validator.checkCyclesInGraph(
      this.nodesRegistry,
      this.pinsRegistry,
      this.wiresRegistry,
      "data",
    );
    this.validator.checkCyclesInGraph(
      this.nodesRegistry,
      this.pinsRegistry,
      this.wiresRegistry,
      "exec",
    );

    // После восстановления всех пинов, вызываем onConfigChange для всех нод (если есть callback'и)
    // Используем итератор напрямую - O(n) но без создания промежуточного массива
    for (const nodeInstance of this.nodesRegistry.getAllNodesIterator()) {
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
        const pinInstance: PinInstance<DataTypes> = {
          nodeUuid,
          uuid: ulid(),
          type,
          name: pinName,
          dataType: pins[pinName as keyof typeof pins] || null,
        };

        this.pinsRegistry.addPin(pinInstance);
      }
    }
  }

  /**
   * Получает экземпляр ноды по UUID
   * O(1) - использует индекс NodesRegistry
   */
  private getNodeInstance(uuid: string): AbstractNodeInstance<string> | undefined {
    return this.nodesRegistry.getNodeByUuid(uuid);
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
    // Добавляем ноду в реестр - O(1) с обновлением всех индексов
    this.nodesRegistry.addNode(nodeInstance as AbstractNodeInstance<string>);
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
        const currentPins = this.pinsRegistry.getPinsByNodeUuid(nodeUuid);
        const currentPinsMap = new Map<string, PinInstance<DataTypes>>();
        for (const pin of currentPins) {
          currentPinsMap.set(pin.name, pin);
        }

        // Обрабатываем существующие пины: удаляем или обновляем
        for (const pin of currentPins) {
          const configPin = configPins.get(pin.name);

          if (!configPin) {
            // Пина нет в конфигурации - удаляем
            this.wiresRegistry.removeWiresByPin(pin.uuid);
            this.pinsRegistry.removePin(pin.uuid);
            currentPinsMap.delete(pin.name);
          } else if (configPin.type !== pin.type) {
            // Тип пина не совпадает с конфигурацией - удаляем старый пин
            // Новый будет создан в следующем цикле
            this.wiresRegistry.removeWiresByPin(pin.uuid);
            this.pinsRegistry.removePin(pin.uuid);
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
        return this.wiresRegistry.isPinWired(pin.uuid);
      },
      getWiredNode: (name: string) => {
        const pin = this.getPinByName(nodeUuid, name);
        if (!pin) {
          return undefined;
        }
        const wires = this.wiresRegistry.getWiresByPin(pin.uuid);
        if (wires.length === 0) {
          return undefined;
        }
        const wire = wires[0];
        if (!wire) {
          return undefined;
        }
        const connectedPinUuid = wire.from === pin.uuid ? wire.to : wire.from;
        const connectedPin = this.pinsRegistry.getPinByUuid(connectedPinUuid);
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
    return this.pinsRegistry.getPinByNameAndNodeUuid(pinName, nodeUuid);
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
    if (!from || from === "undefined") {
      throw new CommutatorError(`Invalid from pin UUID: "${from}"`);
    }
    if (!to || to === "undefined") {
      throw new CommutatorError(`Invalid to pin UUID: "${to}"`);
    }

    const fromPin = this.pinsRegistry.getPinByUuid(from);
    const toPin = this.pinsRegistry.getPinByUuid(to);

    if (!fromPin) {
      throw new CommutatorError(`Pin not found: from pin "${from}"`);
    }
    if (!toPin) {
      throw new CommutatorError(`Pin not found: to pin "${to}"`);
    }

    // Находим ноды по uuid
    const outputNodeInstance = this.getNodeInstance(fromPin.nodeUuid);
    const inputNodeInstance = this.getNodeInstance(toPin.nodeUuid);

    if (!outputNodeInstance || !inputNodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    // Получаем конфигурацию нод
    const outputNodeConfig = this.getNodeConfig(fromPin.nodeUuid);
    const inputNodeConfig = this.getNodeConfig(toPin.nodeUuid);

    if (!outputNodeConfig || !inputNodeConfig) {
      throw new CommutatorError("Node config not found");
    }

    // Получаем пины для валидации (после возможных callback'ов)
    const updatedOutputPin = this.pinsRegistry.getPinByUuid(from);
    const updatedInputPin = this.pinsRegistry.getPinByUuid(to);

    if (!updatedOutputPin || !updatedInputPin) {
      throw new CommutatorError("Pin not found after callback");
    }

    this.validator.validateWire(
      updatedOutputPin,
      updatedInputPin,
      this.wiresRegistry,
      this.nodesRegistry,
    );

    if (
      this.validator.willCreateCycleInteractive(
        this.nodesRegistry,
        this.pinsRegistry,
        this.wiresRegistry,
        updatedOutputPin.type === PinInstanceType.OutputExec ? "exec" : "data",
        { from: updatedOutputPin.uuid, to: updatedInputPin.uuid },
      )
    ) {
      throw new CommutatorError("Cyclic connection detected in pins");
    }

    // Создаем провод и добавляем его в реестр
    const wire: Wire = { from, to };
    this.wiresRegistry.addWire(wire);
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

      // Удаляем провод в обоих направлениях (на случай если был создан в обратном порядке)
      this.wiresRegistry.removeWire(fromPin.uuid, toPin.uuid);
      this.wiresRegistry.removeWire(toPin.uuid, fromPin.uuid);

      return;
    }

    // Удаляем провод в обоих направлениях
    this.wiresRegistry.removeWire(options.fromPinUuid, options.toPinUuid);
    this.wiresRegistry.removeWire(options.toPinUuid, options.fromPinUuid);
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

    this.pinsRegistry.addPin(pinInstance);
  }

  /**
   * Обновление пина в ноде. Позволяет изменить имя и/или тип пина.
   */
  updatePin(pinUuid: string, args: { name?: string; dataType?: Field<DataTypes> }): void {
    const pin = this.pinsRegistry.getPinByUuid(pinUuid);
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
      // Обновляем имя пина через registry
      this.pinsRegistry.updatePinName(pinUuid, args.name);
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
    const currentPin = this.pinsRegistry.getPinByUuid(uuid);

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
    const nodePins = this.pinsRegistry
      .getPinsByNodeUuid(currentPin.nodeUuid)
      .filter((p) => p.type === currentPin.type);

    if (nodePins.length <= 1) {
      throw new CommutatorError("Cannot remove last pin from node");
    }

    // Удаляем все провода, подключенные к этому пину
    this.wiresRegistry.removeWiresByPin(uuid);

    this.pinsRegistry.removePin(uuid);
  }

  moveNode(uuid: string, x: number, y: number): void {
    const nodeInstance = this.getNodeInstance(uuid);
    if (!nodeInstance) {
      throw new CommutatorError("Node instance not found");
    }

    // Обновляем позицию ноды через реестр - O(1) с обновлением индексов
    this.nodesRegistry.updateNode(uuid, (node) => ({ ...node, x, y }));
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

    // Обновляем config через реестр - O(1) с обновлением индексов
    this.nodesRegistry.updateNode(uuid, (node) => ({ ...node, config }));

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
    return this.pinsRegistry.getPinsByNodeUuid(nodeUuid).map((pin) => ({ ...pin }));
  }

  extract(): SchemaSnapshot {
    return {
      nodes: this.nodesRegistry.getAllNodes(),
      pinInstances: this.pinsRegistry.getAllPins(),
      wires: this.wiresRegistry.getAllWires(),
    };
  }
}
