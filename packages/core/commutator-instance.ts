import { ulid } from "./util/ulid";
import { NodeType, PinInstanceType } from "./enums";
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
} from "./types";
import type { PinInstance } from "types/pin-instance";

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
      eventConfig.pinsIn,
      eventConfig.pinsOut,
      eventConfig.execPinsIn,
      eventConfig.execPinsOut
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
      refConfig.pinsIn,
      refConfig.pinsOut,
      refConfig.execPinsIn,
      refConfig.execPinsOut
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
      pureFunctionConfig.pinsIn,
      pureFunctionConfig.pinsOut,
      pureFunctionConfig.execPinsIn,
      pureFunctionConfig.execPinsOut
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
      functionConfig.pinsIn,
      functionConfig.pinsOut,
      functionConfig.execPinsIn,
      functionConfig.execPinsOut
    );

    return functionInstance;
  }

  wire(from: string, to: string): void {
    const fromPin = this.pinInstances[from];
    const toPin = this.pinInstances[to];

    if (!fromPin || !toPin) {
      throw new Error("Pin not found");
    }

    if (
      (fromPin.type === PinInstanceType.Output &&
        toPin.type === PinInstanceType.Input) ||
      (fromPin.type === PinInstanceType.Input &&
        toPin.type === PinInstanceType.Output)
    ) {
      this.wires.push({
        from,
        to,
      });
    }

    if (
      (fromPin.type === PinInstanceType.OutputExec &&
        toPin.type === PinInstanceType.InputExec) ||
      (fromPin.type === PinInstanceType.InputExec &&
        toPin.type === PinInstanceType.OutputExec)
    ) {
      this.wires.push({
        from,
        to,
      });
    }
  }
}

// TODO функция выгрузки текущего инстанса
// TODO функция создания инстанса из выгрузки
// TODO доделать проверку циклических связей в графах
