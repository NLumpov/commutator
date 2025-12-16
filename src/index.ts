import { CommonDataType } from "./enums/common-data-type";
import type { Field } from "./types/field";

export function createCommutator<
  const DataTypes extends Record<string, Field<DataTypes>> = {}
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
      return createCommutator<DataTypes & { [K in Name]: DataType }>({
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
  })
