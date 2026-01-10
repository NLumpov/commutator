/**
 * Пример 2: Все типы данных
 *
 * Демонстрирует использование всех типов данных:
 * - String
 * - Number
 * - Boolean
 * - Date
 * - Object
 * - Array
 * - StringEnum
 * - NumberEnum
 * - Any
 */

import { CommonDataType, Commutator } from "@commutator/core";

const commutator = Commutator.initialize()
  // String
  .definePureFunction("concatStrings", {
    pinsIn: {
      a: { type: CommonDataType.String },
      b: { type: CommonDataType.String },
    },
    pinsOut: {
      result: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => ({
      result: `${pinsIn.a ?? ""}${pinsIn.b ?? ""}`,
    }),
  })
  // Number
  .definePureFunction("multiplyNumbers", {
    pinsIn: {
      a: { type: CommonDataType.Number },
      b: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.a ?? 0) * (pinsIn.b ?? 1),
    }),
  })
  // Boolean
  .definePureFunction("andLogic", {
    pinsIn: {
      a: { type: CommonDataType.Boolean },
      b: { type: CommonDataType.Boolean },
    },
    pinsOut: {
      result: { type: CommonDataType.Boolean },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.a ?? false) && (pinsIn.b ?? false),
    }),
  })
  // Date
  .definePureFunction("getTimestamp", {
    pinsIn: {
      date: { type: CommonDataType.Date },
    },
    pinsOut: {
      timestamp: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => ({
      timestamp: pinsIn.date ?? Date.now(),
    }),
  })
  // Object
  .defineDataType("Person", {
    type: CommonDataType.Object,
    properties: {
      name: { type: CommonDataType.String },
      age: { type: CommonDataType.Number },
    },
  })
  .definePureFunction("getPersonName", {
    pinsIn: {
      person: { type: "Person" },
    },
    pinsOut: {
      name: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => ({
      name: pinsIn.person?.name ?? "",
    }),
  })
  // Array
  .definePureFunction("sumArray", {
    pinsIn: {
      numbers: { type: CommonDataType.Array, itemType: { type: CommonDataType.Number } },
    },
    pinsOut: {
      sum: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const numbers = pinsIn.numbers ?? [];
      const sum = numbers.reduce(
        (acc: number, val: unknown) => acc + ((typeof val === "number" ? val : 0) ?? 0),
        0,
      );
      return { sum };
    },
  })
  // StringEnum
  .definePureFunction("checkStatus", {
    pinsIn: {
      status: {
        type: CommonDataType.StringEnum,
        values: ["pending", "approved", "rejected"],
      },
    },
    pinsOut: {
      isValid: { type: CommonDataType.Boolean },
    },
    exec: async ({ pinsIn }) => ({
      isValid: pinsIn.status === "approved",
    }),
  })
  // NumberEnum
  .definePureFunction("checkPriority", {
    pinsIn: {
      priority: {
        type: CommonDataType.NumberEnum,
        values: [1, 2, 3],
      },
    },
    pinsOut: {
      isHigh: { type: CommonDataType.Boolean },
    },
    exec: async ({ pinsIn }) => ({
      isHigh: pinsIn.priority === 3,
    }),
  })
  // Any
  .definePureFunction("passThrough", {
    pinsIn: {
      value: { type: CommonDataType.Any },
    },
    pinsOut: {
      result: { type: CommonDataType.Any },
    },
    exec: async ({ pinsIn }) => ({
      result: pinsIn.value,
    }),
  });

const schema = commutator.createSchema();

export { commutator, schema };
