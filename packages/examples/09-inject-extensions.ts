/**
 * Пример 9: Инъекция расширений (Inject)
 *
 * Демонстрирует:
 * - inject() - объединение коммутаторов
 * - Создание модульных расширений
 * - Комбинирование функциональности из разных коммутаторов
 */

import { CommonDataType, Commutator } from "@commutator/core";

// Базовый коммутатор с общими типами данных
const baseCommutator = Commutator.initialize()
  .defineDataType("User", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      name: { type: CommonDataType.String },
    },
  })
  .defineEvent("onUserAction", {
    pinsOut: {
      userId: { type: CommonDataType.String },
    },
    execPinsOut: {
      next: null,
    },
  });

// Расширение для математических операций
const mathExtension = Commutator.initialize()
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
      a: { type: CommonDataType.Number },
      b: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.a ?? 0) * (pinsIn.b ?? 1),
    }),
  })
  .definePureFunction("subtract", {
    pinsIn: {
      a: { type: CommonDataType.Number },
      b: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.a ?? 0) - (pinsIn.b ?? 0),
    }),
  });

// Расширение для работы со строками
const stringExtension = Commutator.initialize()
  .definePureFunction("concat", {
    pinsIn: {
      a: { type: CommonDataType.String },
      b: { type: CommonDataType.String },
    },
    pinsOut: {
      result: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => ({
      result: `${pinsIn.a ?? ""}${pinsIn.b ?? ""}`,
    }),
  })
  .definePureFunction("toUpperCase", {
    pinsIn: {
      value: { type: CommonDataType.String },
    },
    pinsOut: {
      result: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.value ?? "").toUpperCase(),
    }),
  });

// Расширение для работы с пользователями
// Используем базовый коммутатор, который уже имеет тип User
const userExtension = baseCommutator
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
    resolveRef: async ({ config }) => ({
      user: {
        id: config?.userId ?? "unknown",
        name: "John Doe",
      },
    }),
  })
  .defineFunction("logUser", {
    pinsIn: {
      user: { type: "User" },
    },
    pinsOut: {},
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      next: null,
    },
    exec: async ({ pinsIn, exec }) => {
      console.log("User:", pinsIn.user);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

// Объединение всех расширений
const combinedCommutator = baseCommutator
  .inject(mathExtension)
  .inject(stringExtension)
  .inject(userExtension);

// Создание схемы из объединенного коммутатора
const schema = combinedCommutator.createSchema();

// Использование всех типов нод из разных расширений
const userAction = schema.createEvent("onUserAction");
const add = schema.createPureFunction("add");
const multiply = schema.createPureFunction("multiply");
const concat = schema.createPureFunction("concat");
const userRef = schema.createRef("userRef", { userId: "user-123" });
const logUser = schema.createFunction("logUser");

// Создание связей между нодами из разных расширений
// userRef получает userId через конфигурацию, поэтому обновляем конфигурацию
schema.updateNodeConfig(userRef.instance.uuid, { userId: "user-from-action" });
schema.wire({
  from: { node: userRef.instance.uuid, pin: "user" },
  to: { node: logUser.instance.uuid, pin: "user" },
});
userAction.wire("next", logUser, "start");

console.log("✅ Пример 9: Инъекция расширений");
console.log("Объединены расширения:");
console.log("  - baseCommutator (User, onUserAction)");
console.log("  - mathExtension (add, multiply, subtract)");
console.log("  - stringExtension (concat, toUpperCase)");
console.log("  - userExtension (userRef, logUser)");
console.log("\nСозданы ноды из разных расширений:");
console.log(`  - Event: ${userAction.instance.name} (из baseCommutator)`);
console.log(`  - PureFunction: ${add.instance.name}, ${multiply.instance.name} (из mathExtension)`);
console.log(`  - PureFunction: ${concat.instance.name} (из stringExtension)`);
console.log(`  - Ref: ${userRef.instance.name} (из userExtension)`);
console.log(`  - Function: ${logUser.instance.name} (из userExtension)`);
console.log("\nСозданы связи между нодами из разных расширений");
console.log("✅ Инъекция расширений работает!");

export { combinedCommutator, schema, userAction, add, multiply, concat, userRef, logUser };
