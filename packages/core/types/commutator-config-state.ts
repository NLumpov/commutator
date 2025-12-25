import type { Field } from "./field";
import type {
  EventNode,
  FunctionNode,
  PureFunctionNode,
  RefNode,
} from "./nodes";

export type CommutatorConfigState<
  DataTypes extends Record<string, Field<DataTypes>> = {},
  Events extends Record<
    string,
    EventNode<DataTypes, any, any, any, any, any>
  > = {},
  Refs extends Record<
    string,
    RefNode<DataTypes, Apis, any, any, any, any, any>
  > = {},
  PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, any, any, any, any, any>
  > = {},
  Functions extends Record<
    string,
    FunctionNode<DataTypes, any, any, any, any, any>
  > = {},
  Apis extends Record<string, any> = {}
> = {
  dataTypes: DataTypes;
  events: Events;
  refs: Refs;
  pureFunctions: PureFunctions;
  functions: Functions;
  apis: Apis;
};
