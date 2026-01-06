import { CommutatorSchema } from "./commutator-schema";
import type { CommonDataType } from "./enums";
import type {
  CommutatorInstanceSnapshot,
  EventNode,
  ExecPin,
  Field,
  FunctionNode,
  Pin,
  PureFunctionNode,
  RefNode,
} from "./types";

const extractKey = Symbol("extract");

export class Commutator<
  const DataTypes extends Record<string, Field<DataTypes>> = {},
  const Events extends Record<string, EventNode<DataTypes, any, any, any, any, any, any>> = {},
  const Refs extends Record<string, RefNode<DataTypes, any, any, any, any, any, any, any>> = {},
  const PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, any, any, any, any, any, any>
  > = {},
  const Functions extends Record<string, FunctionNode<DataTypes, any, any, any, any, any, any>> = {},
  const Apis extends Record<string, any> = {},
> {
  private constructor(
    private dataTypes: DataTypes,
    private events: Events,
    private refs: Refs,
    private pureFunctions: PureFunctions,
    private functions: Functions,
    private apis: Apis,
  ) {}

  static initialize<
    const DataTypes extends Record<string, Field<DataTypes>> = {},
    const Events extends Record<string, EventNode<DataTypes, any, any, any, any, any, any>> = {},
    const Refs extends Record<string, RefNode<DataTypes, any, any, any, any, any, any, any>> = {},
    const PureFunctions extends Record<
      string,
      PureFunctionNode<DataTypes, any, any, any, any, any, any>
    > = {},
    const Functions extends Record<string, FunctionNode<DataTypes, any, any, any, any, any, any>> = {},
    const Apis extends Record<string, any> = {},
  >(
    dataTypes: DataTypes = {} as DataTypes,
    events: Events = {} as Events,
    refs: Refs = {} as Refs,
    pureFunctions: PureFunctions = {} as PureFunctions,
    functions: Functions = {} as Functions,
    apis: Apis = {} as Apis,
  ): Commutator<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    return new Commutator(dataTypes, events, refs, pureFunctions, functions, apis);
  }

  defineDataType<const Name extends string, const DataType extends Field<DataTypes>>(
    name: Name extends keyof DataTypes | keyof typeof CommonDataType ? never : Name,
    dataType: DataType,
  ): Commutator<
    DataTypes & { [K in Name]: DataType },
    Events,
    Refs,
    PureFunctions,
    Functions,
    Apis
  > {
    const extendedDataTypes = {
      ...this.dataTypes,
      [name]: dataType,
    } as DataTypes & { [K in Name]: DataType };

    return new Commutator<
      DataTypes & { [K in Name]: DataType },
      Events,
      Refs,
      PureFunctions,
      Functions,
      Apis
    >(extendedDataTypes, this.events, this.refs, this.pureFunctions, this.functions, this.apis);
  }

  defineEvent<
    const Name extends string,
    const Meta extends Field<DataTypes> | undefined,
    const Config extends Field<DataTypes> | undefined,
    const PinsIn extends Record<string, Pin<DataTypes>>,
    const PinsOut extends Record<string, Pin<DataTypes>>,
    const ExecPinsIn extends Record<string, ExecPin>,
    const ExecPinsOut extends Record<string, ExecPin>,
  >(
    name: Name extends keyof Events | keyof Refs | keyof PureFunctions | keyof Functions
      ? never
      : Name,
    eventNode: Pick<
      EventNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>,
      "execPinsOut" | "pinsOut" | "meta" | "config"
    >,
  ): Commutator<
    DataTypes,
    Events & {
      [K in Name]: EventNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>;
    },
    Refs,
    PureFunctions,
    Functions,
    Apis
  > {
    const extendedEvents = {
      ...this.events,
      [name]: eventNode,
    };

    return new Commutator<
      DataTypes,
      Events & {
        [K in Name]: EventNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>;
      },
      Refs,
      PureFunctions,
      Functions,
      Apis
    >(this.dataTypes, extendedEvents, this.refs, this.pureFunctions, this.functions, this.apis);
  }

  defineRef<
    const Name extends string,
    const Meta extends Field<DataTypes> | undefined,
    const Config extends Field<DataTypes> | undefined,
    const PinsIn extends Record<string, Pin<DataTypes>>,
    const PinsOut extends Record<string, Pin<DataTypes>>,
    const ExecPinsIn extends Record<string, ExecPin>,
    const ExecPinsOut extends Record<string, ExecPin>,
  >(
    name: Name extends keyof Events | keyof Refs | keyof PureFunctions | keyof Functions
      ? never
      : Name,
    refNode: Pick<
      RefNode<DataTypes, Meta, Config, Apis, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>,
      "pinsOut" | "resolveRef" | "meta" | "config"
    >,
  ): Commutator<
    DataTypes,
    Events,
    Refs & {
      [K in Name]: RefNode<DataTypes, Meta, Config, Apis, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>;
    },
    PureFunctions,
    Functions,
    Apis
  > {
    const extendedRefs = {
      ...this.refs,
      [name]: refNode,
    };

    return new Commutator<
      DataTypes,
      Events,
      Refs & {
        [K in Name]: RefNode<
          DataTypes,
          Meta,
          Config,
          Apis,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >;
      },
      PureFunctions,
      Functions,
      Apis
    >(this.dataTypes, this.events, extendedRefs, this.pureFunctions, this.functions, this.apis);
  }

  definePureFunction<
    const Name extends string,
    const Meta extends Field<DataTypes> | undefined,
    const Config extends Field<DataTypes> | undefined,
    const PinsIn extends Record<string, Pin<DataTypes>>,
    const PinsOut extends Record<string, Pin<DataTypes>>,
    const ExecPinsIn extends Record<string, ExecPin>,
    const ExecPinsOut extends Record<string, ExecPin>,
  >(
    name: Name extends keyof Events | keyof Refs | keyof PureFunctions | keyof Functions
      ? never
      : Name,
    pureFunctionNode: Pick<
      PureFunctionNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>,
      "pinsIn" | "pinsOut" | "canAddPinIn" | "canAddPinOut" | "exec" | "config"
    >,
  ): Commutator<
    DataTypes,
    Events,
    Refs,
    PureFunctions & {
      [K in Name]: PureFunctionNode<
        DataTypes,
        Meta,
        Config,
        PinsIn,
        PinsOut,
        ExecPinsIn,
        ExecPinsOut
      >;
    },
    Functions,
    Apis
  > {
    const extendedPureFunctions = {
      ...this.pureFunctions,
      [name]: pureFunctionNode,
    };

    return new Commutator<
      DataTypes,
      Events,
      Refs,
      PureFunctions & {
        [K in Name]: PureFunctionNode<
          DataTypes,
          Meta,
          Config,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >;
      },
      Functions,
      Apis
    >(this.dataTypes, this.events, this.refs, extendedPureFunctions, this.functions, this.apis);
  }

  defineFunction<
    const Name extends string,
    const Meta extends Field<DataTypes> | undefined,
    const Config extends Field<DataTypes> | undefined,
    const PinsIn extends Record<string, Pin<DataTypes>>,
    const PinsOut extends Record<string, Pin<DataTypes>>,
    const ExecPinsIn extends Record<string, ExecPin>,
    const ExecPinsOut extends Record<string, ExecPin>,
  >(
    name: Name extends keyof Events | keyof Refs | keyof PureFunctions | keyof Functions
      ? never
      : Name,
    functionNode: Pick<
      FunctionNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>,
      | "pinsIn"
      | "pinsOut"
      | "canAddPinIn"
      | "canAddPinOut"
      | "execPinsIn"
      | "execPinsOut"
      | "canAddExecPinIn"
      | "canAddExecPinOut"
      | "exec"
      | "meta"
      | "config"
    >,
  ): Commutator<
    DataTypes,
    Events,
    Refs,
    PureFunctions,
    Functions & {
      [K in Name]: FunctionNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>;
    },
    Apis
  > {
    const extendedFunctions = {
      ...this.functions,
      [name]: functionNode,
    };

    return new Commutator<
      DataTypes,
      Events,
      Refs,
      PureFunctions,
      Functions & {
        [K in Name]: FunctionNode<
          DataTypes,
          Meta,
          Config,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >;
      },
      Apis
    >(this.dataTypes, this.events, this.refs, this.pureFunctions, extendedFunctions, this.apis);
  }

  [extractKey](): {
    dataTypes: DataTypes;
    events: Events;
    refs: Refs;
    pureFunctions: PureFunctions;
    functions: Functions;
    apis: Apis;
  } {
    return {
      dataTypes: this.dataTypes,
      events: this.events,
      refs: this.refs,
      pureFunctions: this.pureFunctions,
      functions: this.functions,
      apis: this.apis,
    };
  }

  inject<
    const LocalDataTypes extends Record<string, Field<LocalDataTypes>> = {},
    const LocalEvents extends Record<
      string,
      EventNode<LocalDataTypes, any, any, any, any, any, any>
    > = {},
    const LocalRefs extends Record<
      string,
      RefNode<LocalDataTypes, any, any, any, any, any, any, any>
    > = {},
    const LocalPureFunctions extends Record<
      string,
      PureFunctionNode<LocalDataTypes, any, any, any, any, any, any>
    > = {},
    const LocalFunctions extends Record<
      string,
      FunctionNode<LocalDataTypes, any, any, any, any, any, any>
    > = {},
    const LocalApis extends Record<string, any> = {},
  >(
    other: Commutator<
      LocalDataTypes,
      LocalEvents,
      LocalRefs,
      LocalPureFunctions,
      LocalFunctions,
      LocalApis
    >,
  ): Commutator<
    DataTypes & LocalDataTypes,
    Events & LocalEvents,
    Refs & LocalRefs,
    PureFunctions & LocalPureFunctions,
    Functions & LocalFunctions,
    Apis & LocalApis
  > {
    const otherConfig = other[extractKey]();

    return new Commutator<
      DataTypes & LocalDataTypes,
      Events & LocalEvents,
      Refs & LocalRefs,
      PureFunctions & LocalPureFunctions,
      Functions & LocalFunctions,
      Apis & LocalApis
    >(
      { ...this.dataTypes, ...otherConfig.dataTypes },
      { ...this.events, ...otherConfig.events },
      { ...this.refs, ...otherConfig.refs },
      {
        ...this.pureFunctions,
        ...otherConfig.pureFunctions,
      },
      { ...this.functions, ...otherConfig.functions },
      { ...this.apis, ...otherConfig.apis },
    );
  }

  createSchema(snapshot?: CommutatorInstanceSnapshot) {
    return CommutatorSchema.initialize(
      this.dataTypes,
      this.events,
      this.refs,
      this.pureFunctions,
      this.functions,
      this.apis,
      snapshot,
    );
  }
}
