import { CommonDataType, Commutator } from "@commutator/core";

export const logicalExtension = Commutator.initialize().defineDataType(
  "goolean",
  {
    type: CommonDataType.Object,
    properties: {},
  }
);