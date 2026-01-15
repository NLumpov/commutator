/** biome-ignore-all lint/style/noNonNullAssertion: Для примеров выключено */
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
      next: null,
      cancel: null,
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
      start: null,
    },
    execPinsOut: {
      route1: null,
      route2: null,
      route3: null,
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

console.log("✅ Пример 12: Управление пинами");
console.log("\nПолучение конкретных пинов:");
console.log(`  X pin: ${xPin.name} (${xPin.type}, ${xPin.dataType?.type ?? "null"})`);
console.log(`  Y pin: ${yPin.name} (${yPin.type}, ${yPin.dataType?.type ?? "null"})`);
console.log(
  `  Result pin: ${resultPin.name} (${resultPin.type}, ${resultPin.dataType?.type ?? "null"})`,
);

// Получение всех пинов ноды
const onClickPins = schema.getNodePins(onClick.uuid);
const addPins = schema.getNodePins(add.uuid);
const routerPins = schema.getNodePins(router.uuid);

console.log("\nВсе пины нод:");
console.log("  onClick:", onClickPins.map((p) => `${p.name} (${p.type})`).join(", "));
console.log("  add:", addPins.map((p) => `${p.name} (${p.type})`).join(", "));
console.log("  router:", routerPins.map((p) => `${p.name} (${p.type})`).join(", "));

// Фильтрация пинов по типу
const onClickOutputPins = onClickPins.filter((pin) => pin.type === PinInstanceType.Output);
const onClickExecPins = onClickPins.filter((pin) => pin.type === PinInstanceType.OutputExec);

const addInputPins = addPins.filter((pin) => pin.type === PinInstanceType.Input);
const addOutputPins = addPins.filter((pin) => pin.type === PinInstanceType.Output);

const routerExecOutPins = routerPins.filter((pin) => pin.type === PinInstanceType.OutputExec);

console.log("\nФильтрация пинов по типу:");
console.log("  onClick output pins:", onClickOutputPins.map((p) => p.name).join(", "));
console.log("  onClick exec pins:", onClickExecPins.map((p) => p.name).join(", "));
console.log("  add input pins:", addInputPins.map((p) => p.name).join(", "));
console.log("  add output pins:", addOutputPins.map((p) => p.name).join(", "));
console.log("  router exec out pins:", routerExecOutPins.map((p) => p.name).join(", "));

// Использование пинов для создания связей
schema.wire({
  from: { node: onClick.uuid, pin: "x" },
  to: { node: add.uuid, pin: "a" },
});
schema.wire({
  from: { node: onClick.uuid, pin: "y" },
  to: { node: add.uuid, pin: "b" },
});

// Работа с exec-пинами
const onClickNextExecPin = onClickExecPins.find((p) => p.name === "next");
const routerStartExecPin = schema.getPin(router.uuid, "start");

if (onClickNextExecPin && routerStartExecPin) {
  schema.wire({
    fromPinUuid: onClickNextExecPin.uuid,
    toPinUuid: routerStartExecPin.uuid,
  });
  console.log("\nСоздана связь через найденные пины:");
  console.log(`  ${onClickNextExecPin.name} -> ${routerStartExecPin.name}`);
}
console.log("\n✅ Управление пинами работает!");

export { schema, onClick, add, router };
