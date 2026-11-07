/**
 * Пример 4: Подключение пинов
 *
 * Демонстрирует:
 * - wire() с разными синтаксисами
 * - unwire()
 * - Подключение data-пинов
 * - Подключение exec-пинов
 */

import { CommonDataType, Commutator } from "@commutator/core";

const commutator = Commutator.initialize()
  .defineEvent("onClick", {
    pinsOut: {
      x: { type: CommonDataType.Number },
      y: { type: CommonDataType.Number },
    },
    execPinsOut: {
      next: null,
    },
  })
  .definePureFunction("add", {
    pinsIn: {
      a: { type: CommonDataType.Number },
      b: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
    }),
  })
  .definePureFunction("multiply", {
    pinsIn: {
      value: { type: CommonDataType.Number },
      factor: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.value ?? 0) * (pinsIn.factor ?? 1),
    }),
  })
  .defineFunction("log", {
    pinsIn: {
      message: { type: CommonDataType.String },
      value: { type: CommonDataType.Number },
    },
    pinsOut: {},
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      next: null,
    },
    exec: async ({ pinsIn, exec }) => {
      console.log(pinsIn.message, pinsIn.value);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

const onClick = schema.createEvent("onClick");
const add = schema.createPureFunction("add");
const multiply = schema.createPureFunction("multiply");
const log = schema.createFunction("log");

// Подключение data-пинов по именам.
schema.wire({
  from: { node: multiply.uuid, pin: "result" },
  to: { node: log.uuid, pin: "value" },
});
// Подключение exec-пинов по UUID.
const onClickExecPin = schema.getPin(onClick.uuid, "next");
const logExecPin = schema.getPin(log.uuid, "start");

schema.wire({
  fromPinUuid: onClickExecPin.uuid,
  toPinUuid: logExecPin.uuid,
});

console.log("✅ Пример 4: Подключение пинов");
console.log("Созданы связи:");
console.log("  - multiply.result -> log.value (data)");
console.log("  - onClick.next -> log.start (exec)");

// Отключение пинов работает так же
console.log("\nОтключение связей:");
schema.unwire({ fromPinUuid: onClickExecPin.uuid, toPinUuid: logExecPin.uuid });
console.log("  - onClick.next -> log.start (отключено)");
schema.unwire({
  from: { node: multiply.uuid, pin: "result" },
  to: { node: log.uuid, pin: "value" },
});
console.log("  - multiply.result -> log.value (отключено)");
console.log("✅ Подключение и отключение пинов работает!");

export { schema, onClick, add, multiply, log };
