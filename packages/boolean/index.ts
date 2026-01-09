import { CommonDataType, Commutator } from "@commutator/core";

export const booleanExtension = Commutator.initialize()
  .definePureFunction("Not", {
    pinsIn: {
      A: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: !pinsIn.A,
    }),
  })
  .definePureFunction("And", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Boolean(pinsIn.A) && Boolean(pinsIn.B),
    }),
  })
  .definePureFunction("Or", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Boolean(pinsIn.A) || Boolean(pinsIn.B),
    }),
  })
  .definePureFunction("Xor", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = Boolean(pinsIn.A);
      const b = Boolean(pinsIn.B);
      return {
        Result: (a && !b) || (!a && b),
      };
    },
  })
  .definePureFunction("Nand", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: !(Boolean(pinsIn.A) && Boolean(pinsIn.B)),
    }),
  })
  .definePureFunction("Nor", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: !(Boolean(pinsIn.A) || Boolean(pinsIn.B)),
    }),
  })
  .definePureFunction("Xnor", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: (Boolean(pinsIn.A) && Boolean(pinsIn.B)) || (!pinsIn.A && !pinsIn.B),
    }),
  })
  .definePureFunction("Implies", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: !pinsIn.A || Boolean(pinsIn.B),
    }),
  })
  .definePureFunction("Equals", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: pinsIn.A === pinsIn.B,
    }),
  })
  .definePureFunction("NotEquals", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: pinsIn.A !== pinsIn.B,
    }),
  })
  .definePureFunction("GreaterThan", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.A ?? 0) > (pinsIn.B ?? 0),
    }),
  })
  .definePureFunction("LessThan", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.A ?? 0) < (pinsIn.B ?? 0),
    }),
  })
  .definePureFunction("GreaterThanOrEqual", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.A ?? 0) >= (pinsIn.B ?? 0),
    }),
  })
  .definePureFunction("LessThanOrEqual", {
    pinsIn: {
      A: { type: CommonDataType.Any },
      B: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.A ?? 0) <= (pinsIn.B ?? 0),
    }),
  })
  .definePureFunction("IsNull", {
    pinsIn: {
      Value: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: pinsIn.Value === null || pinsIn.Value === undefined,
    }),
  })
  .definePureFunction("IsNotNull", {
    pinsIn: {
      Value: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: pinsIn.Value !== null && pinsIn.Value !== undefined,
    }),
  })
  .definePureFunction("IsEmpty", {
    pinsIn: {
      Value: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value;
      if (value === null || value === undefined) {
        return { Result: true };
      }
      if (Array.isArray(value)) {
        return { Result: value.length === 0 };
      }
      if (typeof value === "object") {
        return { Result: Object.keys(value).length === 0 };
      }
      return { Result: !value };
    },
  })
  .definePureFunction("IsNotEmpty", {
    pinsIn: {
      Value: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value;
      if (value === null || value === undefined) {
        return { Result: false };
      }
      if (Array.isArray(value)) {
        return { Result: value.length > 0 };
      }
      if (typeof value === "object") {
        return { Result: Object.keys(value).length > 0 };
      }
      return { Result: Boolean(value) };
    },
  });
