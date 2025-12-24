import type { Field } from "./field";
import type {
  AbstractNode,
  EventNode,
  FunctionNode,
  PureFunctionNode,
  RefNode,
} from "./nodes";

export type CommutatorConfigState<
  DataTypes extends Record<string, Field<DataTypes>> = {},
  Nodes extends Record<
    string,
    AbstractNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {},
  Events extends Record<
    string,
    EventNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {},
  Refs extends Record<
    string,
    RefNode<DataTypes, Nodes, Apis, any, any, any, any, any, any>
  > = {},
  PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {},
  Functions extends Record<
    string,
    FunctionNode<DataTypes, Nodes, any, any, any, any, any, any>
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
