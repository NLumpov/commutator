/**
 * Пример 12: Управление пинами
 *
 * Демонстрирует:
 * - getPin() - получение пина по UUID ноды и имени
 * - getNodePins() - получение всех пинов ноды
 * - Фильтрация пинов по типу
 * - Работа с пинами через различные методы
 */

import { CommonDataType, Commutator, PinInstanceType } from "@commutator/core";

const commutator = Commutator.initialize()
  .defineEvent("onClick", {
    pinsOut: {
      x: { type: CommonDataType.Number },
      y: { type: CommonDataType.Number },
      button: { type: CommonDataType.Number },
    },
    execPinsOut: {
      next: {},
      cancel: {},
    },
  })
  .definePureFunction("add", {
    pinsIn: {
      a: { type: CommonDataType.Number },
      b: { type: CommonDataType.Number },
      c: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
      sum: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const sum = (pinsIn.a ?? 0) + (pinsIn.b ?? 0) + (pinsIn.c ?? 0);
      return {
        result: sum,
        sum,
      };
    },
  })
  .defineFunction("router", {
    pinsIn: {
      value: { type: CommonDataType.Number },
    },
    pinsOut: {},
    execPinsIn: {
      start: {},
    },
    execPinsOut: {
      route1: {},
      route2: {},
      route3: {},
    },
    exec: async ({ exec }) => {
      await exec({
        execPinOut: "route1",
        pinsOut: {},
        meta: null,
      });
      await exec({
        execPinOut: "route2",
        pinsOut: {},
        meta: null,
      });
      await exec({
        execPinOut: "route3",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

const onClick = schema.createEvent("onClick");
const add = schema.createPureFunction("add");
const router = schema.createFunction("router");

// Получение конкретного пина
const xPin = schema.getPin(onClick.uuid, "x");
const yPin = schema.getPin(onClick.uuid, "y");
const resultPin = schema.getPin(add.uuid, "result");

console.log("X pin:", xPin.name, xPin.type, xPin.pinType);
console.log("Y pin:", yPin.name, yPin.type, yPin.pinType);
console.log("Result pin:", resultPin.name, resultPin.type, resultPin.pinType);

// Получение всех пинов ноды
const onClickPins = schema.getNodePins(onClick.uuid);
const addPins = schema.getNodePins(add.uuid);
const routerPins = schema.getNodePins(router.uuid);

console.log(
  "onClick pins:",
  onClickPins.map((p) => `${p.name} (${p.type})`),
);
console.log(
  "add pins:",
  addPins.map((p) => `${p.name} (${p.type})`),
);
console.log(
  "router pins:",
  routerPins.map((p) => `${p.name} (${p.type})`),
);

// Фильтрация пинов по типу
const onClickOutputPins = onClickPins.filter((pin) => pin.type === PinInstanceType.Output);
const onClickExecPins = onClickPins.filter((pin) => pin.type === PinInstanceType.OutputExec);

const addInputPins = addPins.filter((pin) => pin.type === PinInstanceType.Input);
const addOutputPins = addPins.filter((pin) => pin.type === PinInstanceType.Output);

const routerExecOutPins = routerPins.filter((pin) => pin.type === PinInstanceType.OutputExec);

console.log(
  "onClick output pins:",
  onClickOutputPins.map((p) => p.name),
);
console.log(
  "onClick exec pins:",
  onClickExecPins.map((p) => p.name),
);
console.log(
  "add input pins:",
  addInputPins.map((p) => p.name),
);
console.log(
  "add output pins:",
  addOutputPins.map((p) => p.name),
);
console.log(
  "router exec out pins:",
  routerExecOutPins.map((p) => p.name),
);

// Использование пинов для создания связей
schema.wire(onClickOutputPins[0]!.uuid, addInputPins[0]!.uuid);
schema.wire(onClickOutputPins[1]!.uuid, addInputPins[1]!.uuid);

// Работа с exec-пинами
const onClickNextExecPin = onClickExecPins.find((p) => p.name === "next");
const routerStartExecPin = schema.getPin(router.uuid, "start");

if (onClickNextExecPin && routerStartExecPin) {
  schema.wire(onClickNextExecPin.uuid, routerStartExecPin.uuid);
}

export { schema, onClick, add, router };
