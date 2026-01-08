import { CommutatorSchema, type SchemaSnapshot } from "../schema";
import { CommutatorConfig } from "./commutator-config";
import { CommutatorValidator } from "./commutator-validator";
import type { CommonDataType } from "./enums";
import type {
  EventNode,
  ExecPin,
  Field,
  FunctionNode,
  Pin,
  PureFunctionNode,
  RefNode,
} from "./types";

export class Commutator<
  const DataTypes extends Record<string, Field<DataTypes>> = {},
  const Events extends Record<string, EventNode<any, any, any, any, any, any, any, any>> = {},
  const Refs extends Record<string, RefNode<any, any, any, any, any, any, any, any>> = {},
  const PureFunctions extends Record<
    string,
    PureFunctionNode<any, any, any, any, any, any, any, any>
  > = {},
  const Functions extends Record<string, FunctionNode<any, any, any, any, any, any, any, any>> = {},
  const Apis extends Record<string, any> = {},
> {
  public validator: CommutatorValidator<DataTypes>;

  private constructor(
    private config: CommutatorConfig<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
  ) {
    this.validator = new CommutatorValidator(config.dataTypes);
  }

  static initialize<
    const DataTypes extends Record<string, Field<DataTypes>> = {},
    const Events extends Record<string, EventNode<any, any, any, any, any, any, any, any>> = {},
    const Refs extends Record<string, RefNode<any, any, any, any, any, any, any, any>> = {},
    const PureFunctions extends Record<
      string,
      PureFunctionNode<any, any, any, any, any, any, any, any>
    > = {},
    const Functions extends Record<
      string,
      FunctionNode<any, any, any, any, any, any, any, any>
    > = {},
    const Apis extends Record<string, any> = {},
  >(
    dataTypes: DataTypes = {} as DataTypes,
    events: Events = {} as Events,
    refs: Refs = {} as Refs,
    pureFunctions: PureFunctions = {} as PureFunctions,
    functions: Functions = {} as Functions,
    apis: Apis = {} as Apis,
  ): Commutator<DataTypes, Events, Refs, PureFunctions, Functions, Apis> {
    return new Commutator(
      new CommutatorConfig(dataTypes, events, refs, pureFunctions, functions, apis),
    );
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
    return new Commutator<
      DataTypes & { [K in Name]: DataType },
      Events,
      Refs,
      PureFunctions,
      Functions,
      Apis
    >(
      new CommutatorConfig(
        { ...this.config.dataTypes, [name]: dataType },
        this.config.events,
        this.config.refs,
        this.config.pureFunctions,
        this.config.functions,
        this.config.apis,
      ),
    );
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
      EventNode<DataTypes, Meta, Config, Apis, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>,
      "execPinsOut" | "pinsOut" | "meta" | "config" | "onConfigChange"
    >,
  ): Commutator<
    DataTypes,
    Events & {
      [K in Name]: EventNode<
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
    Refs,
    PureFunctions,
    Functions,
    Apis
  > {
    return new Commutator(
      new CommutatorConfig(
        this.config.dataTypes,
        { ...this.config.events, [name]: eventNode },
        this.config.refs,
        this.config.pureFunctions,
        this.config.functions,
        this.config.apis,
      ),
    );
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
      "pinsOut" | "resolveRef" | "meta" | "config" | "onConfigChange"
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
    return new Commutator(
      new CommutatorConfig(
        this.config.dataTypes,
        this.config.events,
        {
          ...this.config.refs,
          [name]: refNode as RefNode<
            DataTypes,
            Meta,
            Config,
            Apis,
            PinsIn,
            PinsOut,
            ExecPinsIn,
            ExecPinsOut
          >,
        },
        this.config.pureFunctions,
        this.config.functions,
        this.config.apis,
      ),
    );
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
      PureFunctionNode<DataTypes, Meta, Config, Apis, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>,
      "pinsIn" | "pinsOut" | "canAddPinIn" | "canAddPinOut" | "exec" | "config" | "onConfigChange"
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
        Apis,
        PinsIn,
        PinsOut,
        ExecPinsIn,
        ExecPinsOut
      >;
    },
    Functions,
    Apis
  > {
    return new Commutator(
      new CommutatorConfig(
        this.config.dataTypes,
        this.config.events,
        this.config.refs,
        {
          ...this.config.pureFunctions,
          [name]: pureFunctionNode as PureFunctionNode<
            DataTypes,
            Meta,
            Config,
            Apis,
            PinsIn,
            PinsOut,
            ExecPinsIn,
            ExecPinsOut
          >,
        },
        this.config.functions,
        this.config.apis,
      ),
    );
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
      FunctionNode<DataTypes, Meta, Config, Apis, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut>,
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
      | "onConfigChange"
    >,
  ): Commutator<
    DataTypes,
    Events,
    Refs,
    PureFunctions,
    Functions & {
      [K in Name]: FunctionNode<
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
    Apis
  > {
    return new Commutator(
      new CommutatorConfig(
        this.config.dataTypes,
        this.config.events,
        this.config.refs,
        this.config.pureFunctions,
        {
          ...this.config.functions,
          [name]: functionNode as FunctionNode<
            DataTypes,
            Meta,
            Config,
            Apis,
            PinsIn,
            PinsOut,
            ExecPinsIn,
            ExecPinsOut
          >,
        },
        this.config.apis,
      ),
    );
  }

  inject<
    const LocalDataTypes extends Record<string, Field<LocalDataTypes>> = {},
    const LocalEvents extends Record<
      string,
      EventNode<LocalDataTypes, any, any, any, any, any, any, any>
    > = {},
    const LocalRefs extends Record<
      string,
      RefNode<LocalDataTypes, any, any, any, any, any, any, any>
    > = {},
    const LocalPureFunctions extends Record<
      string,
      PureFunctionNode<LocalDataTypes, any, any, any, any, any, any, any>
    > = {},
    const LocalFunctions extends Record<
      string,
      FunctionNode<LocalDataTypes, any, any, any, any, any, any, any>
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
    return new Commutator(
      new CommutatorConfig(
        { ...this.config.dataTypes, ...other.config.dataTypes },
        { ...this.config.events, ...other.config.events },
        { ...this.config.refs, ...other.config.refs },
        { ...this.config.pureFunctions, ...other.config.pureFunctions },
        { ...this.config.functions, ...other.config.functions },
        { ...this.config.apis, ...other.config.apis },
      ),
    );
  }

  createSchema(snapshot?: SchemaSnapshot) {
    return CommutatorSchema.initialize(this.config, snapshot);
  }
}
