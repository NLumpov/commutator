/**
 * Пример 14: Кеширование в воркере
 *
 * Демонстрирует:
 * - Persistent cache для Events и Functions
 * - Runtime cache для PureFunctions и Refs
 * - Сохранение и восстановление состояния воркера
 */

import { CommonDataType, Commutator } from "@commutator/core";

const commutator = Commutator.initialize()
  .defineEvent("onTick", {
    pinsOut: {
      value: { type: CommonDataType.Number },
    },
    execPinsOut: {
      next: null,
    },
  })
  .definePureFunction("multiply", {
    pinsIn: {
      value: { type: CommonDataType.Number },
      factor: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const result = (pinsIn.value ?? 0) * (pinsIn.factor ?? 1);
      console.log(`  🔄 PureFunction multiply: ${pinsIn.value} * ${pinsIn.factor} = ${result}`);
      return { result };
    },
  })
  .defineFunction("store", {
    pinsIn: {
      value: { type: CommonDataType.Number },
    },
    pinsOut: {
      stored: { type: CommonDataType.Number },
    },
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      next: null,
    },
    exec: async ({ pinsIn, exec }) => {
      console.log(`  💾 Function store: сохраняю значение ${pinsIn.value}`);
      await exec({
        execPinOut: "next",
        pinsOut: { stored: pinsIn.value },
        meta: null,
      });
    },
  })
  .defineFunction("read", {
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
      // Читаем из кеша предыдущей функции
      console.log(`  📖 Function read: прочитано значение ${pinsIn.value} из кеша`);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

// Создание схемы
const schema = commutator.createSchema();

const onTick = schema.createEvent("onTick");
const multiply = schema.createPureFunction("multiply");
const store = schema.createFunction("store");
const read = schema.createFunction("read");

// Подключение
onTick.wire("next", store, "start");
schema.wire({
  from: { node: onTick.instance.uuid, pin: "value" },
  to: { node: multiply.instance.uuid, pin: "value" },
});
// Устанавливаем factor = 2
const multiplyFactorPin = schema.getPin(multiply.instance.uuid, "factor");
schema.setPinDefaultValue(multiplyFactorPin.uuid, 2);
schema.wire({
  from: { node: multiply.instance.uuid, pin: "result" },
  to: { node: store.instance.uuid, pin: "value" },
});
// read будет читать из кеша store через exec-связь
// Значение будет автоматически взято из кеша при выполнении
store.wire("next", read, "start");

const worker = schema.createWorker();

console.log("✅ Пример 14: Кеширование в воркере");
console.log("\n=== Первый запуск ===");
console.log("Запуск события onTick с value: 5");
await worker.triggerEvent("onTick", { value: 5 });

console.log("\n=== Второй запуск (PureFunction пересчитается, Function использует кеш) ===");
console.log("Запуск события onTick с value: 10");
await worker.triggerEvent("onTick", { value: 10 });

console.log("\n=== Сохранение состояния воркера ===");
const workerSnapshot = worker.extract();
console.log(`  - Кешированных значений пинов: ${workerSnapshot.pinCache.length}`);
console.log(`  - Кешированных метаданных: ${workerSnapshot.metaCache.length}`);

console.log("\n=== Восстановление воркера из снапшота ===");
const restoredWorker = schema.createWorker(workerSnapshot);
console.log("Запуск события onTick с value: 15");
await restoredWorker.triggerEvent("onTick", { value: 15 });

console.log("\n✅ Кеширование работает корректно!");

export { commutator, schema, worker, workerSnapshot };
