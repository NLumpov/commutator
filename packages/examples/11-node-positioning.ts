/**
 * Пример 11: Позиционирование нод
 *
 * Демонстрирует:
 * - moveNode() - перемещение нод
 * - Работа с координатами нод
 * - Использование позиций при экспорте/импорте
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
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.value ?? 0) * 2,
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
  });

const schema = commutator.createSchema();

// Создание нод
const onClick = schema.createEvent("onClick");
const add = schema.createPureFunction("add");
const multiply = schema.createPureFunction("multiply");
const log = schema.createFunction("log");

// Позиционирование нод в виде графа (слева направо)
schema.moveNode(onClick.instance.uuid, 0, 0);
schema.moveNode(add.instance.uuid, 200, 0);
schema.moveNode(multiply.instance.uuid, 400, 0);
schema.moveNode(log.instance.uuid, 600, 0);

// Создание связей
schema.wire({
  from: { node: onClick.instance.uuid, pin: "x" },
  to: { node: add.instance.uuid, pin: "a" },
});
schema.wire({
  from: { node: onClick.instance.uuid, pin: "y" },
  to: { node: add.instance.uuid, pin: "b" },
});
schema.wire({
  from: { node: add.instance.uuid, pin: "result" },
  to: { node: multiply.instance.uuid, pin: "value" },
});
schema.wire({
  from: { node: multiply.instance.uuid, pin: "result" },
  to: { node: log.instance.uuid, pin: "value" },
});
schema.wire({
  from: { node: onClick.instance.uuid, pin: "next" },
  to: { node: log.instance.uuid, pin: "start" },
});

console.log("✅ Пример 11: Позиционирование нод");

// Проверка позиций через снапшот
const snapshot = schema.extract();
console.log("\nНачальные позиции нод:");
snapshot.nodes.forEach((node) => {
  console.log(`  ${node.name}: (${node.x}, ${node.y})`);
});

// Перемещение нод (например, для визуального редактора)
schema.moveNode(onClick.instance.uuid, 100, 100);
schema.moveNode(add.instance.uuid, 300, 100);
schema.moveNode(multiply.instance.uuid, 500, 100);
schema.moveNode(log.instance.uuid, 700, 100);

console.log("\nПеремещение нод:");
console.log("  onClick: (0, 0) -> (100, 100)");
console.log("  add: (200, 0) -> (300, 100)");
console.log("  multiply: (400, 0) -> (500, 100)");
console.log("  log: (600, 0) -> (700, 100)");

// Восстановление позиций из снапшота
const restoredSchema = commutator.createSchema(snapshot);
const restoredSnapshot = restoredSchema.extract();

console.log("\nВосстановленные позиции из снапшота:");
restoredSnapshot.nodes.forEach((node) => {
  console.log(`  ${node.name}: (${node.x}, ${node.y})`);
});
console.log("✅ Позиционирование нод работает!");

export { schema, restoredSchema, snapshot };
