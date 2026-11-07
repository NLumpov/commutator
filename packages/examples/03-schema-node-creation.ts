/**
 * Пример 3: Создание нод в схеме
 *
 * Демонстрирует:
 * - createEvent()
 * - createRef()
 * - createPureFunction()
 * - createFunction()
 * - Создание нод с конфигурацией
 */

import { CommonDataType, Commutator } from "@commutator/core";

const commutator = Commutator.initialize()
  .defineDataType("Config", {
    type: CommonDataType.Object,
    properties: {
      userId: { type: CommonDataType.String },
      threshold: { type: CommonDataType.Number },
    },
  })
  .defineEvent("onStart", {
    pinsOut: {
      value: { type: CommonDataType.Number },
    },
    execPinsOut: {
      next: null,
    },
  })
  .defineRef("userRef", {
    pinsOut: {
      userId: { type: CommonDataType.String },
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        userId: { type: CommonDataType.String },
      },
    },
    resolveRef: async ({ config }) => ({
      userId: config?.userId ?? "default",
    }),
  })
  .definePureFunction("multiply", {
    pinsIn: {
      a: { type: CommonDataType.Number },
      b: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        multiplier: { type: CommonDataType.Number },
      },
    },
    exec: async ({ pinsIn, config }) => ({
      result: (pinsIn.a ?? 0) * (pinsIn.b ?? 1) * (config?.multiplier ?? 1),
    }),
  })
  .defineFunction("conditionalLog", {
    pinsIn: {
      message: { type: CommonDataType.String },
      condition: { type: CommonDataType.Boolean },
    },
    pinsOut: {},
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      next: null,
      skip: null,
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        logLevel: { type: CommonDataType.String },
      },
    },
    exec: async ({ pinsIn, exec, config }) => {
      if (pinsIn.condition) {
        console.log(`[${config?.logLevel ?? "INFO"}]`, pinsIn.message);
        await exec({
          execPinOut: "next",
          pinsOut: {},
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "skip",
          pinsOut: {},
          meta: null,
        });
      }
    },
  });

const schema = commutator.createSchema();

// Создание событий
const startEvent = schema.createEvent("onStart");

// Создание референсов с конфигурацией
const userRef = schema.createRef("userRef", { userId: "user-123" });

// Создание чистых функций с конфигурацией
const multiply = schema.createPureFunction("multiply", { multiplier: 2 });

// Создание функций с конфигурацией
const conditionalLog = schema.createFunction("conditionalLog", { logLevel: "DEBUG" });

console.log("✅ Пример 3: Создание нод в схеме");
console.log("Созданы ноды:");
console.log(`  - Event: ${startEvent.name} (UUID: ${startEvent.uuid})`);
console.log(
  `  - Ref: ${userRef.name} (UUID: ${userRef.uuid}, config: ${JSON.stringify(userRef.config)})`,
);
console.log(
  `  - PureFunction: ${multiply.name} (UUID: ${multiply.uuid}, config: ${JSON.stringify(multiply.config)})`,
);
console.log(
  `  - Function: ${conditionalLog.name} (UUID: ${conditionalLog.uuid}, config: ${JSON.stringify(conditionalLog.config)})`,
);
console.log("✅ Все ноды созданы успешно!");

export { schema, startEvent, userRef, multiply, conditionalLog };
