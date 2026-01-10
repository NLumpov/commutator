/**
 * Пример 5: Fluent API
 *
 * Демонстрирует:
 * - FluentNodeBuilder (возвращается из createEvent/createRef/createPureFunction/createFunction)
 * - NodeBuilder (через schema.node())
 * - PinBuilder (через node().pin())
 * - Цепочки методов для создания связей
 */

import { CommonDataType, Commutator } from "@commutator/core";

const commutator = Commutator.initialize()
  .defineEvent("onClick", {
    pinsOut: {
      x: { type: CommonDataType.Number },
      y: { type: CommonDataType.Number },
    },
    execPinsOut: {
      next: {},
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
      start: {},
    },
    execPinsOut: {
      next: {},
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

// FluentNodeBuilder - цепочка методов при создании ноды
const onClick = schema
  .createEvent("onClick")
  .wire("x", schema.createPureFunction("add"), "a")
  .wire("y", schema.createPureFunction("add"), "b");

// NodeBuilder - работа с нодой через schema.node()
const add = schema.createPureFunction("add");
schema.node(add.uuid).wireTo("result", schema.createPureFunction("multiply"), "value");

// PinBuilder - работа с пином через node().pin()
const multiply = schema.createPureFunction("multiply");
const log = schema.createFunction("log");

schema.node(multiply.uuid).pin("result").wireTo(log, "value");
schema.node(onClick.uuid).pin("next").wireTo(log, "start");

// Комбинированный пример: создание и подключение в одной цепочке
const result = schema
  .createPureFunction("add")
  .wire("result", schema.createPureFunction("multiply"), "value");

export { schema, onClick, add, multiply, log, result };
