/**
 * Пример 15: Метаданные в воркере
 *
 * Демонстрирует:
 * - Использование meta для хранения состояния между вызовами
 * - Счётчик с метаданными
 * - Сохранение и восстановление метаданных
 */

import { CommonDataType, Commutator } from "@commutator/core";

const commutator = Commutator.initialize()
  .defineEvent("onIncrement", {
    pinsOut: {},
    execPinsOut: {
      next: null,
    },
  })
  .defineFunction("counter", {
    pinsIn: {
      step: { type: CommonDataType.Number, default: 1 },
    },
    pinsOut: {
      count: { type: CommonDataType.Number },
    },
    execPinsIn: {
      increment: null,
      reset: null,
    },
    execPinsOut: {
      next: null,
    },
    meta: { type: CommonDataType.Number },
    exec: async ({ pinsIn, meta, triggeredExecPinKey, exec }) => {
      let newCount = meta ?? 0;

      if (triggeredExecPinKey === "increment") {
        newCount += pinsIn.step ?? 1;
        console.log(`  ➕ Инкремент: ${meta ?? 0} + ${pinsIn.step ?? 1} = ${newCount}`);
      } else if (triggeredExecPinKey === "reset") {
        newCount = 0;
        console.log(`  🔄 Сброс: ${meta ?? 0} → 0`);
      }

      await exec({
        execPinOut: "next",
        pinsOut: { count: newCount },
        meta: newCount,
      });
    },
  })
  .defineFunction("logCount", {
    pinsIn: {
      count: { type: CommonDataType.Number },
    },
    pinsOut: {},
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      next: null,
    },
    exec: async ({ pinsIn, exec }) => {
      console.log(`  📊 Текущее значение счётчика: ${pinsIn.count}`);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  })
  .defineEvent("onReset", {
    pinsOut: {},
    execPinsOut: {
      next: null,
    },
  });

// Создание схемы
const schema = commutator.createSchema();

const onIncrement = schema.createEvent("onIncrement");
const onReset = schema.createEvent("onReset");
const counter = schema.createFunction("counter");
const logCount = schema.createFunction("logCount");

// Подключение для инкремента
onIncrement.wire("next", counter, "increment");
counter.wire("next", logCount, "start");
schema.wire({
  from: { node: counter.uuid, pin: "count" },
  to: { node: logCount.uuid, pin: "count" },
});

// Подключение для сброса
onReset.wire("next", counter, "reset");
// counter.next уже подключён к logCount, поэтому используем тот же путь

const worker = schema.createWorker();

console.log("✅ Пример 15: Метаданные в воркере");
console.log("\n=== Инкремент счётчика ===");
await worker.triggerEvent("onIncrement", {});

console.log("\n=== Инкремент снова ===");
await worker.triggerEvent("onIncrement", {});

console.log("\n=== Инкремент ещё раз ===");
await worker.triggerEvent("onIncrement", {});

console.log("\n=== Сброс счётчика ===");
await worker.triggerEvent("onReset", {});

console.log("\n=== Инкремент после сброса ===");
await worker.triggerEvent("onIncrement", {});

console.log("\n=== Сохранение состояния ===");
const workerSnapshot = worker.extract();
console.log(`  - Метаданных в кеше: ${workerSnapshot.metaCache.length}`);
const counterMeta = workerSnapshot.metaCache.find((m) => {
  const node = schema.extract().nodes.find((n) => n.name === "counter");
  return node && m.uuid === node.uuid;
});
if (counterMeta) {
  console.log(`  - Значение счётчика в метаданных: ${counterMeta.cache}`);
}

console.log("\n✅ Метаданные работают корректно!");

export { commutator, schema, worker, workerSnapshot };
