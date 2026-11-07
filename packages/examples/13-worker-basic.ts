/**
 * Пример 13: Базовое использование воркера
 *
 * Демонстрирует:
 * - createWorker() - создание воркера из схемы
 * - triggerEvent() - запуск события с payload
 * - Выполнение графа через push и pull стратегии
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
    exec: async ({ pinsIn }) => {
      const result = (pinsIn.a ?? 0) + (pinsIn.b ?? 0);
      return { result };
    },
  })
  .defineFunction("log", {
    pinsIn: {
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
      console.log(`  📝 Результат вычисления: ${pinsIn.value}`);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

// Создание схемы
const schema = commutator.createSchema();

// Создание нод
const onClick = schema.createEvent("onClick");
const add = schema.createPureFunction("add");
const log = schema.createFunction("log");

// Подключение пинов
onClick.wire("x", add, "a").wire("y", add, "b").wire("next", log, "start");
schema.wire({
  from: { node: add.instance.uuid, pin: "result" },
  to: { node: log.instance.uuid, pin: "value" },
});

// Создание воркера
const worker = schema.createWorker();

console.log("✅ Пример 13: Базовое использование воркера");
console.log("\nЗапуск события onClick с payload { x: 10, y: 20 }:");

// Запуск события
await worker.triggerEvent("onClick", { x: 10, y: 20 });

console.log("\nЗапуск события onClick с payload { x: 100, y: 200 }:");

// Запуск события снова
await worker.triggerEvent("onClick", { x: 100, y: 200 });

console.log("\n✅ Воркер успешно выполнил граф!");

export { commutator, schema, worker };
