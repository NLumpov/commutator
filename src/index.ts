import type {
  FunctionNode,
  PureFunctionNode,
  RefNode,
  AbstractNode,
  EventNode,
} from "@declarations/nodes";
import { CommonDataType } from "@enums/common-data-type";
import type { Field } from "@declarations/field";
import type { ExecPin, Pin } from "@declarations/pin";

export function createCommutator<
  const DataTypes extends Record<string, Field<DataTypes>> = {},
  const Nodes extends Record<
    string,
    AbstractNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {},
  const Events extends Record<
    string,
    EventNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {},
  const Refs extends Record<
    string,
    RefNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {},
  const PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {},
  const Functions extends Record<
    string,
    FunctionNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {}
>(
  state: {
    dataTypes: DataTypes;
    events: Events;
    refs: Refs;
    pureFunctions: PureFunctions;
    functions: Functions;
  } = {
    dataTypes: {} as DataTypes,
    events: {} as Events,
    refs: {} as Refs,
    pureFunctions: {} as PureFunctions,
    functions: {} as Functions,
  }
) {
  return {
    defineDataType<
      const Name extends string,
      const DataType extends Field<DataTypes>
    >(
      name: Name extends keyof DataTypes | keyof typeof CommonDataType
        ? never
        : Name,
      dataType: DataType
    ) {
      type Extension = { [K in Name]: DataType };
      type ExtendedNodes = Nodes & {
        [K in Name]: AbstractNode<
          DataTypes & Extension,
          Nodes,
          any,
          any,
          any,
          any,
          any,
          any
        >;
      };
      type ExtendedEvents = Events & {
        [K in Name]: EventNode<
          DataTypes & Extension,
          Nodes,
          any,
          any,
          any,
          any,
          any,
          any
        >;
      };
      type ExtendedRefs = Refs & {
        [K in Name]: RefNode<
          DataTypes & Extension,
          Nodes,
          any,
          any,
          any,
          any,
          any,
          any
        >;
      };
      type ExtendedPureFunctions = PureFunctions & {
        [K in Name]: PureFunctionNode<
          DataTypes & Extension,
          Nodes,
          any,
          any,
          any,
          any,
          any,
          any
        >;
      };
      type ExtendedFunctions = Functions & {
        [K in Name]: FunctionNode<
          DataTypes & Extension,
          Nodes,
          any,
          any,
          any,
          any,
          any,
          any
        >;
      };
      return createCommutator<
        DataTypes & Extension,
        ExtendedNodes,
        ExtendedEvents,
        ExtendedRefs,
        ExtendedPureFunctions,
        ExtendedFunctions
      >({
        ...state,
        events: state?.events ?? ({} as ExtendedEvents),
        refs: (state?.refs ?? {}) as ExtendedRefs,
        pureFunctions: (state?.pureFunctions ?? {}) as ExtendedPureFunctions,
        functions: (state?.functions ?? {}) as ExtendedFunctions,
        dataTypes: {
          ...state?.dataTypes,
          [name]: dataType,
        } as DataTypes & Extension,
      });
    },
    defineEvent<
      const Name extends string,
      const Meta extends Field<DataTypes>,
      const PinsIn extends Record<string, Pin<DataTypes>>,
      const PinsOut extends Record<string, Pin<DataTypes>>,
      const ExecPinsIn extends Record<string, ExecPin>,
      const ExecPinsOut extends Record<string, ExecPin>
    >(
      name: Name extends keyof Nodes ? never : Name,
      eventNode: Pick<
        EventNode<
          DataTypes,
          Nodes,
          Meta,
          Name,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >,
        "execPinsOut" | "meta"
      >
    ) {
      type ExtendedEvents = Events & {
        [K in Name]: EventNode<
          DataTypes,
          Nodes,
          Meta,
          Name,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >;
      };
      return createCommutator<
        DataTypes,
        Nodes & {
          [K in Name]: AbstractNode<
            DataTypes,
            Nodes,
            Meta,
            Name,
            PinsIn,
            PinsOut,
            ExecPinsIn,
            ExecPinsOut
          >;
        },
        ExtendedEvents,
        Refs,
        PureFunctions,
        Functions
      >({
        ...state,
        events: {
          ...state?.events,
          [name]: eventNode,
        },
      });
    },
    defineRef<
      const Name extends string,
      const Meta extends Field<DataTypes>,
      const PinsIn extends Record<string, Pin<DataTypes>>,
      const PinsOut extends Record<string, Pin<DataTypes>>,
      const ExecPinsIn extends Record<string, ExecPin>,
      const ExecPinsOut extends Record<string, ExecPin>
    >(
      name: Name extends keyof Nodes ? never : Name,
      refNode: Pick<
        RefNode<
          DataTypes,
          Nodes,
          Meta,
          Name,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >,
        "pinsOut" | "meta"
      >
    ) {
      type ExtendedRefs = Refs & {
        [K in Name]: RefNode<
          DataTypes,
          Nodes,
          Meta,
          Name,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >;
      };
      return createCommutator<
        DataTypes,
        Nodes & {
          [K in Name]: AbstractNode<
            DataTypes,
            Nodes,
            Meta,
            Name,
            PinsIn,
            PinsOut,
            ExecPinsIn,
            ExecPinsOut
          >;
        },
        Events,
        ExtendedRefs,
        PureFunctions,
        Functions
      >({
        ...state,
        refs: {
          ...state?.refs,
          [name]: refNode,
        },
      });
    },
    definePureFunction<
      const Name extends string,
      const Meta extends Field<DataTypes>,
      const PinsIn extends Record<string, Pin<DataTypes>>,
      const PinsOut extends Record<string, Pin<DataTypes>>,
      const ExecPinsIn extends Record<string, ExecPin>,
      const ExecPinsOut extends Record<string, ExecPin>
    >(
      name: Name extends keyof Nodes ? never : Name,
      pureFunctionNode: Pick<
        PureFunctionNode<
          DataTypes,
          Nodes,
          Meta,
          Name,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >,
        "pinsIn" | "pinsOut" | "canAddPinIn" | "canAddPinOut"
      >
    ) {
      type ExtendedPureFunctions = PureFunctions & {
        [K in Name]: PureFunctionNode<
          DataTypes,
          Nodes,
          Meta,
          Name,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >;
      };
      return createCommutator<
        DataTypes,
        Nodes & {
          [K in Name]: AbstractNode<
            DataTypes,
            Nodes,
            Meta,
            Name,
            PinsIn,
            PinsOut,
            ExecPinsIn,
            ExecPinsOut
          >;
        },
        Events,
        Refs,
        ExtendedPureFunctions,
        Functions
      >({
        ...state,
        pureFunctions: {
          ...state?.pureFunctions,
          [name]: pureFunctionNode,
        },
      });
    },
    defineFunction<
      const Name extends string,
      const Meta extends Field<DataTypes>,
      const PinsIn extends Record<string, Pin<DataTypes>>,
      const PinsOut extends Record<string, Pin<DataTypes>>,
      const ExecPinsIn extends Record<string, ExecPin>,
      const ExecPinsOut extends Record<string, ExecPin>
    >(
      name: Name extends keyof Nodes ? never : Name,
      functionNode: Pick<
        FunctionNode<
          DataTypes,
          Nodes,
          Meta,
          Name,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >,
        | "pinsIn"
        | "pinsOut"
        | "canAddPinIn"
        | "canAddPinOut"
        | "execPinsIn"
        | "execPinsOut"
        | "canAddExecPinIn"
        | "canAddExecPinOut"
        | "meta"
      >
    ) {
      type ExtendedFunctions = Functions & {
        [K in Name]: FunctionNode<
          DataTypes,
          Nodes,
          Meta,
          Name,
          PinsIn,
          PinsOut,
          ExecPinsIn,
          ExecPinsOut
        >;
      };

      return createCommutator<
        DataTypes,
        Nodes & {
          [K in Name]: AbstractNode<
            DataTypes,
            Nodes,
            Meta,
            Name,
            PinsIn,
            PinsOut,
            ExecPinsIn,
            ExecPinsOut
          >;
        },
        Events,
        Refs,
        PureFunctions,
        ExtendedFunctions
      >({
        ...state,
        functions: {
          ...state?.functions,
          [name]: functionNode,
        },
      });
    },
  };
}

const commutator = createCommutator()
  .defineDataType("Test", {
    type: CommonDataType.String,
    name: "Test",
  })
  .defineDataType("Test2", {
    type: CommonDataType.Object,
    name: "Test",
    properties: { test: { type: "Test", name: "Test" } },
  })
  .defineEvent("TestEvent", {
    execPinsOut: {
      key: "Test",
    },
    meta: {
      type: "Test",
      name: "Test",
    },
  });