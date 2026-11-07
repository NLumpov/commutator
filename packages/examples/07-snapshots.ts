/**
 * Пример 7: Снапшоты (Snapshots)
 *
 * Демонстрирует:
 * - extract() - экспорт схемы в снапшот
 * - createSchema(snapshot) - создание схемы из снапшота
 * - Сериализация и десериализация схем
 * - Worker baseline после полного trigger и продолжение в новом Worker
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
      console.log("Value:", pinsIn.value);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
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
  });

// Создание первой схемы
const schema1 = commutator.createSchema();

const onClick = schema1.createEvent("onClick");
const add = schema1.createPureFunction("add");
const log = schema1.createFunction("log");
schema1.createRef("userRef", { userId: "user-123" });

// Перемещение нод
schema1.moveNode(onClick.uuid, 100, 200);
schema1.moveNode(add.uuid, 300, 200);
schema1.moveNode(log.uuid, 500, 200);

// Создание связей
schema1.wire({ from: { node: onClick.uuid, pin: "x" }, to: { node: add.uuid, pin: "a" } });
schema1.wire({ from: { node: onClick.uuid, pin: "y" }, to: { node: add.uuid, pin: "b" } });
schema1.wire({ from: { node: add.uuid, pin: "result" }, to: { node: log.uuid, pin: "value" } });
schema1.wire({ from: { node: onClick.uuid, pin: "next" }, to: { node: log.uuid, pin: "start" } });

// Экспорт схемы в снапшот
const snapshot = schema1.extract();

console.log("\n✅ Пример 7: Снапшоты (Snapshots)");
console.log("Экспортирован снапшот схемы:");
console.log(`  - Нод: ${snapshot.nodes.length}`);
console.log(`  - Пинов: ${snapshot.pinInstances.length}`);
console.log(`  - Связей: ${snapshot.wires.length}`);

// Создание новой схемы из снапшота
const schema2 = commutator.createSchema(snapshot);

// Проверка, что все ноды восстановлены
const schema2Nodes = schema2.extract().nodes;
const schema2Wires = schema2.extract().wires;

console.log("\nВосстановлена схема из снапшота:");
console.log(`  - Нод восстановлено: ${schema2Nodes.length}`);
console.log(`  - Связей восстановлено: ${schema2Wires.length}`);

// Проверка позиций нод
const restoredOnClick = schema2Nodes.find((n) => n.name === "onClick");
if (restoredOnClick) {
  console.log(`  - Позиция onClick: (${restoredOnClick.x}, ${restoredOnClick.y})`);
}

// Проверка конфигурации референса
const restoredUserRef = schema2Nodes.find((n) => n.name === "userRef");
if (restoredUserRef) {
  console.log(`  - Конфигурация userRef:`, restoredUserRef.config);
}

// WorkerSnapshot сохраняется отдельно от схемы, только после полного успешного trigger.
const worker = schema1.createWorker();
await worker.triggerEvent("onClick", { x: 10, y: 20 });
const baseline = worker.extract();
const restoredWorker = schema2.createWorker(JSON.parse(JSON.stringify(baseline)));
if (JSON.stringify(restoredWorker.extract()) !== JSON.stringify(baseline)) {
  throw new Error("Worker baseline did not roundtrip");
}
// Уже завершённый trigger не повторяется; новый запускается с сохранёнными кешами.
await restoredWorker.triggerEvent("onClick", { x: 30, y: 12 });
console.log("Worker baseline восстановлен; новый trigger завершён.");

console.log("✅ Снапшот успешно сохранён и восстановлен!");

export { schema1, schema2, snapshot };
