import type {
  FunctionNode,
  PureFunctionNode,
  RefNode,
  AbstractNode,
  EventNode,
  ExtendRefNodes,
  ExtendEvents,
  ExtendPureFunctions,
  ExtendFunctions,
  ExtendAbstractNodes,
} from "@declarations/nodes";
import { CommonDataType } from "@enums/common-data-type";
import type { Field } from "@declarations/field";

export function createCommutator<
  const DataTypes extends Record<string, Field<DataTypes>> = {},
  const Nodes extends Record<
    string,
    AbstractNode<DataTypes, Nodes, any, any>
  > = {},
  const Events extends Record<
    string,
    EventNode<DataTypes, Nodes, any, any, any, any>
  > = {},
  const Refs extends Record<
    string,
    RefNode<DataTypes, Nodes, any, any, any>
  > = {},
  const PureFunctions extends Record<
    string,
    PureFunctionNode<DataTypes, Nodes, any, any, any, any>
  > = {},
  const Functions extends Record<
    string,
    FunctionNode<DataTypes, Nodes, any, any, any, any, any, any>
  > = {}
>(state?: { dataTypes: DataTypes }) {
  return {
    defineDataType<
      const Name extends string,
      const DataType extends Field<DataTypes>
    >(
      name: Name extends keyof DataTypes | keyof typeof CommonDataType
        ? never
        : Name,
      dataType: Name extends keyof DataTypes | keyof typeof CommonDataType
        ? never
        : DataType
    ) {
      type Extension = { [K in Name]: DataType };
      return createCommutator<
        DataTypes & Extension,
        ExtendAbstractNodes<DataTypes, Extension, Nodes>,
        ExtendEvents<DataTypes, Extension, Nodes, Events>,
        ExtendRefNodes<DataTypes, Extension, Nodes, Refs>,
        ExtendPureFunctions<DataTypes, Extension, Nodes, PureFunctions>,
        ExtendFunctions<DataTypes, Extension, Nodes, Functions>
      >({
        ...state,
        dataTypes: {
          ...state?.dataTypes,
          [name]: dataType,
        } as DataTypes & { [K in Name]: DataType },
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
  });
