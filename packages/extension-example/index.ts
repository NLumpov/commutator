import { CommonDataType, Commutator } from "@commutator/core";

export const exampleExtension = Commutator.initialize().defineDataType("User", {
  type: CommonDataType.Object,
  properties: {
    name: { type: CommonDataType.String },
  },
});
