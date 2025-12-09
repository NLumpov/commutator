import { CommonDataType, commonDataTypes } from "./data-types";
import type { Field } from "./field";
import type { StaticGetterNode } from "./nodes";

type ExcludeNonPrimitiveDataTypes<
  TDataTypes extends Record<string, Field<Record<string, string>>>
> = {
  [Key in keyof TDataTypes]: TDataTypes[Key]["type"] extends Exclude<
    CommonDataType,
    | CommonDataType.Array
    | CommonDataType.Object
    | CommonDataType.StringEnum
    | CommonDataType.NumberEnum
  >
    ? Key
    : never;
}[keyof TDataTypes];

function createCommutator<
  const Config extends {
    dataTypes: Record<string, Field<Record<string, string>>>;
  }
>(config: Config) {
  const staticGetterNodes = new Map<string, StaticGetterNode>();

  return {
    createStaticGetterNode: <
      const TType extends ExcludeNonPrimitiveDataTypes<Config["dataTypes"]>
    >(config: {
      type: TType;
    }) => {
      return {};
    },
  };
}

const commutator = createCommutator({
  dataTypes: {
    ...commonDataTypes,
    Kek: {
      name: "Kek",
      type: CommonDataType.String,
    },
  },
});

const node = commutator.createStaticGetterNode({
  type: CommonDataType.String,
});
