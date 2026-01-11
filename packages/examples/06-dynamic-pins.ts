/**
 * Пример 6: Динамические пины
 *
 * Демонстрирует:
 * - addPinIn()
 * - addPinOut()
 * - addExecPinIn()
 * - addExecPinOut()
 * - removePin()
 * - updatePin()
 * - Ноды с динамическими пинами через callbacks
 */

import { CommonDataType, Commutator, PinInstanceType } from "@commutator/core";

const commutator = Commutator.initialize()
  .definePureFunction("dynamicSum", {
    pinsIn: {
      // Начальный пин
      value1: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    // Разрешаем добавлять входные пины
    addPinIn: ({ actions }) => {
      const currentPins = actions.getAllPins();
      const inputPins = currentPins.filter((pin) => pin.type === PinInstanceType.Input);
      const nextIndex = inputPins.length + 1;
      actions.addPin(`value${nextIndex}`, PinInstanceType.Input, { type: CommonDataType.Number });
    },
    exec: async ({ pinsIn }) => {
      const values = Object.values(pinsIn).filter((v): v is number => typeof v === "number");
      return {
        result: values.reduce((sum, val) => sum + val, 0),
      };
    },
  })
  .defineFunction("dynamicLog", {
    pinsIn: {
      message: { type: CommonDataType.String },
    },
    pinsOut: {},
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      next: null,
    },
    // Разрешаем добавлять выходные exec-пины
    addExecPinOut: ({ actions }) => {
      const currentPins = actions.getAllPins();
      const execOutPins = currentPins.filter((pin) => pin.type === PinInstanceType.OutputExec);
      const nextIndex = execOutPins.length;
      actions.addExecPin(`branch${nextIndex}`, PinInstanceType.OutputExec);
    },
    exec: async ({ execPinsOut, exec }) => {
      // Выполняем все выходные exec-пины
      for (const pinName of Object.keys(execPinsOut)) {
        await exec({
          execPinOut: pinName,
          pinsOut: {},
          meta: null,
        });
      }
    },
  })
  .definePureFunction("variableInputs", {
    pinsIn: {
      input1: { type: CommonDataType.String },
    },
    pinsOut: {
      output1: { type: CommonDataType.String },
    },
    addPinIn: ({ actions }) => {
      const currentPins = actions.getAllPins();
      const inputPins = currentPins.filter((pin) => pin.type === PinInstanceType.Input);
      const nextIndex = inputPins.length + 1;
      actions.addPin(`input${nextIndex}`, PinInstanceType.Input, { type: CommonDataType.String });
    },
    addPinOut: ({ actions }) => {
      const currentPins = actions.getAllPins();
      const outputPins = currentPins.filter((pin) => pin.type === PinInstanceType.Output);
      const nextIndex = outputPins.length + 1;
      actions.addPin(`output${nextIndex}`, PinInstanceType.Output, { type: CommonDataType.String });
    },
    exec: async ({ pinsIn, pinsOut }) => {
      const inputs = Object.values(pinsIn).filter((v): v is string => typeof v === "string");
      const outputs: Record<string, string> = {};
      inputs.forEach((input, index) => {
        outputs[`output${index + 1}`] = input.toUpperCase();
      });
      // Возвращаем только те выходы, которые определены в pinsOut
      const result: Record<string, string> = { output1: "" };
      for (const key of Object.keys(pinsOut)) {
        result[key] = outputs[key] ?? "";
      }
      return result as { output1: string };
    },
  });

const schema = commutator.createSchema();

// Создание нод с динамическими пинами
const dynamicSum = schema.createPureFunction("dynamicSum");
const dynamicLog = schema.createFunction("dynamicLog");
const variableInputs = schema.createPureFunction("variableInputs");

// Добавление входных пинов
schema.addPinIn(dynamicSum.uuid); // Добавит value2
schema.addPinIn(dynamicSum.uuid); // Добавит value3

// Добавление выходных exec-пинов
schema.addExecPinOut(dynamicLog.uuid); // Добавит branch0
schema.addExecPinOut(dynamicLog.uuid); // Добавит branch1

// Добавление входных и выходных пинов
schema.addPinIn(variableInputs.uuid); // Добавит input2
schema.addPinOut(variableInputs.uuid); // Добавит output2

// Получение всех пинов ноды
const sumPins = schema.getNodePins(dynamicSum.uuid);
console.log(
  "Dynamic sum pins:",
  sumPins.map((p) => p.name),
);

// Обновление пина (изменение типа или имени)
const firstPin = sumPins.find((p) => p.name === "value1");
if (firstPin) {
  schema.updatePin(firstPin.uuid, { name: "firstValue" });
}

// Удаление пина (если это не последний пин данного типа)
const pinsToRemove = sumPins.filter((p) => p.name.startsWith("value") && p.name !== "value1");
if (pinsToRemove.length > 0) {
  // Удаляем последний добавленный пин
  const lastPin = pinsToRemove[pinsToRemove.length - 1];
  if (lastPin && pinsToRemove.length > 1) {
    // Можно удалить только если останется хотя бы один пин
    schema.removePin(lastPin.uuid);
  }
}

export { schema, dynamicSum, dynamicLog, variableInputs };
