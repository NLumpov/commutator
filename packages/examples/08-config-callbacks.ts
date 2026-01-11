/**
 * Пример 8: Callbacks конфигурации
 *
 * Демонстрирует:
 * - onConfigChange() - callback при изменении конфигурации
 * - Динамическое изменение пинов через callbacks
 * - Использование actions в callbacks
 */

import { CommonDataType, Commutator, PinInstanceType } from "@commutator/core";

const commutator = Commutator.initialize()
  .defineFunction("configurableRouter", {
    pinsIn: {
      value: { type: CommonDataType.Number },
    },
    pinsOut: {},
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      default: null,
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        routeCount: { type: CommonDataType.Number },
      },
    },
    // Callback при изменении конфигурации
    onConfigChange: ({ config, actions }) => {
      const routeCount = config?.routeCount ?? 1;
      const currentPins = actions.getAllPins();
      const execOutPins = currentPins.filter((pin) => pin.type === PinInstanceType.OutputExec);

      // Удаляем лишние пины, если routeCount уменьшился
      if (execOutPins.length > routeCount) {
        const pinsToRemove = execOutPins.slice(routeCount);
        for (const pin of pinsToRemove) {
          if (execOutPins.length > 1) {
            // Не удаляем последний пин
            actions.removePin(pin.uuid);
          }
        }
      }

      // Добавляем недостающие пины, если routeCount увеличился
      if (execOutPins.length < routeCount) {
        const pinsToAdd = routeCount - execOutPins.length;
        for (let i = 0; i < pinsToAdd; i++) {
          const routeIndex = execOutPins.length + i;
          actions.addExecPin(`route${routeIndex}`, PinInstanceType.OutputExec);
        }
      }
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
  .definePureFunction("dynamicInputs", {
    pinsIn: {
      input1: { type: CommonDataType.String },
    },
    pinsOut: {
      result: { type: CommonDataType.String },
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        inputCount: { type: CommonDataType.Number },
      },
    },
    onConfigChange: ({ config, actions }) => {
      const inputCount = config?.inputCount ?? 1;
      const currentPins = actions.getAllPins();
      const inputPins = currentPins.filter((pin) => pin.type === PinInstanceType.Input);

      // Удаляем лишние пины
      if (inputPins.length > inputCount) {
        const pinsToRemove = inputPins.slice(inputCount);
        for (const pin of pinsToRemove) {
          if (inputPins.length > 1) {
            actions.removePin(pin.uuid);
          }
        }
      }

      // Добавляем недостающие пины
      if (inputPins.length < inputCount) {
        const pinsToAdd = inputCount - inputPins.length;
        for (let i = 0; i < pinsToAdd; i++) {
          const inputIndex = inputPins.length + i + 1;
          actions.addPin(`input${inputIndex}`, PinInstanceType.Input, {
            type: CommonDataType.String,
          });
        }
      }
    },
    exec: async ({ pinsIn }) => {
      const inputs = Object.values(pinsIn).filter((v): v is string => typeof v === "string");
      return {
        result: inputs.join(" "),
      };
    },
  });

const schema = commutator.createSchema();

// Создание ноды с начальной конфигурацией
const router = schema.createFunction("configurableRouter", { routeCount: 2 });

// Проверка начальных пинов
const initialPins = schema.getNodePins(router.uuid);
console.log(
  "Initial pins:",
  initialPins.map((p) => p.name),
);

// Изменение конфигурации (вызовет onConfigChange)
schema.updateNodeConfig(router.uuid, { routeCount: 4 });

// Проверка обновленных пинов
const updatedPins = schema.getNodePins(router.uuid);
console.log(
  "Updated pins:",
  updatedPins.map((p) => p.name),
);

// Пример с динамическими входными пинами
const dynamicInputs = schema.createPureFunction("dynamicInputs", { inputCount: 2 });

const initialInputPins = schema.getNodePins(dynamicInputs.uuid);
console.log(
  "Initial input pins:",
  initialInputPins.map((p) => p.name),
);

// Увеличение количества входов
schema.updateNodeConfig(dynamicInputs.uuid, { inputCount: 5 });

const finalInputPins = schema.getNodePins(dynamicInputs.uuid);
console.log(
  "Final input pins:",
  finalInputPins.map((p) => p.name),
);

export { schema, router, dynamicInputs };
