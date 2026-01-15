/**
 * Пример 1: Базовые методы Commutator
 *
 * Демонстрирует:
 * - Commutator.initialize()
 * - defineDataType()
 * - defineEvent()
 * - definePureFunction()
 * - defineFunction()
 * - defineRef()
 * - defineApi()
 * - createSchema()
 */

import { CommonDataType, Commutator } from "@commutator/core";

// Создание базового коммутатора
const commutator = Commutator.initialize()
  // Определение пользовательского типа данных
  .defineDataType("User", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      name: { type: CommonDataType.String },
      age: { type: CommonDataType.Number },
    },
  })
  // Определение события
  .defineEvent("onClick", {
    pinsOut: {
      x: { type: CommonDataType.Number },
      y: { type: CommonDataType.Number },
    },
    execPinsOut: {
      next: null,
    },
  })
  // Определение чистой функции
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
  // Определение функции с побочными эффектами
  .defineFunction("log", {
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
    exec: async ({ pinsIn, exec }) => {
      console.log(pinsIn.message);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  })
  // Определение API (должно быть до использования в ref)
  .defineApi("userService", {
    getById: async (id: string) => ({
      id,
      name: "John Doe",
      age: 30,
    }),
  })
  // Определение референса
  .defineRef("userRef", {
    pinsOut: {
      user: { type: "User" },
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        userId: { type: CommonDataType.String },
      },
    },
    resolveRef: async ({ config, api }) => {
      const userId = config?.userId ?? "default";
      const user = await api.userService.getById(userId);
      return { user };
    },
  });

// Создание схемы из коммутатора
const schema = commutator.createSchema();

console.log("✅ Пример 1: Базовые методы Commutator");
console.log("Создан коммутатор с:");
console.log("  - Пользовательский тип данных: User");
console.log("  - Событие: onClick");
console.log("  - Чистая функция: add");
console.log("  - Функция: log");
console.log("  - Референс: userRef");
console.log("  - API: userService");
console.log("Схема создана успешно!");

export { commutator, schema };
