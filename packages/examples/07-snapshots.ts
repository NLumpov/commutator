/**
 * Пример 7: Снапшоты (Snapshots)
 *
 * Демонстрирует:
 * - extract() - экспорт схемы в снапшот
 * - createSchema(snapshot) - создание схемы из снапшота
 * - Сериализация и десериализация схем
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

console.log("Snapshot:", JSON.stringify(snapshot, null, 2));

// Создание новой схемы из снапшота
const schema2 = commutator.createSchema(snapshot);

// Проверка, что все ноды восстановлены
const schema2Events = schema2.extract().events;
const schema2Refs = schema2.extract().refs;
const schema2PureFunctions = schema2.extract().pureFunctions;
const schema2Functions = schema2.extract().functions;
const schema2Wires = schema2.extract().wires;

console.log("Restored events:", schema2Events.length);
console.log("Restored refs:", schema2Refs.length);
console.log("Restored pure functions:", schema2PureFunctions.length);
console.log("Restored functions:", schema2Functions.length);
console.log("Restored wires:", schema2Wires.length);

// Проверка позиций нод
const restoredOnClick = schema2Events[0];
if (restoredOnClick) {
  console.log("Restored onClick position:", restoredOnClick.x, restoredOnClick.y);
}

// Проверка конфигурации референса
const restoredUserRef = schema2Refs[0];
if (restoredUserRef) {
  console.log("Restored userRef config:", restoredUserRef.config);
}

export { schema1, schema2, snapshot };
