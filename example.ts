import { CommonDataType, Commutator } from "@commutator/core";
import { flowControlExtension } from "@commutator/flow-control";

// 1. Создаем схему с расширением flow-control
const commutator = Commutator.initialize()
  .inject(flowControlExtension)
  .defineEvent("onButtonClick", {
    pinsOut: {
      buttonName: { type: CommonDataType.String },
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("LogAction", {
    pinsIn: {
      message: { type: CommonDataType.String },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(pinsIn.message);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// ============================================
// ДЕМОНСТРАЦИЯ ВСЕХ НОВЫХ ВОЗМОЖНОСТЕЙ API
// ============================================

// ============================================
// Вариант 1: Упрощенный синтаксис wire (рекомендуется)
// ============================================

const buttonClick = schema.createEvent("onButtonClick");
const switchNode = schema.createFunction("SwitchString");
const log1 = schema.createFunction("LogAction");
const log2 = schema.createFunction("LogAction");

// Подключение пинов напрямую через ноды и имена пинов
schema.wire(buttonClick, "buttonName", switchNode, "value");
schema.wire(buttonClick, "next", switchNode, "");

// Добавляем динамические exec-пины
schema.addExecPinOut(switchNode.uuid); // Создаст "Case 1"
schema.addExecPinOut(switchNode.uuid); // Создаст "Case 2"

// Используем getPin для получения пинов
schema.updatePin(schema.getPin(switchNode.uuid, "Case 1").uuid, {
  name: "PlayButton",
});
schema.updatePin(schema.getPin(switchNode.uuid, "Case 2").uuid, {
  name: "SettingsButton",
});

// Подключение через упрощенный синтаксис
schema.wire(switchNode, "PlayButton", log1, "start");
schema.wire(switchNode, "SettingsButton", log2, "start");

// ============================================
// Вариант 2: Именованные параметры wireWithOptions
// ============================================

const buttonClick2 = schema.createEvent("onButtonClick");
const switchNode2 = schema.createFunction("SwitchString");

// Более явный синтаксис с именованными параметрами
schema.wireWithOptions({
  from: { node: buttonClick2, pin: "buttonName" },
  to: { node: switchNode2, pin: "value" },
});

schema.wireWithOptions({
  from: { node: buttonClick2, pin: "next" },
  to: { node: switchNode2, pin: "" },
});

// ============================================
// Вариант 3: Fluent API через node()
// ============================================

const buttonClick3 = schema.createEvent("onButtonClick");
const switchNode3 = schema.createFunction("SwitchString");
const log3 = schema.createFunction("LogAction");

// Fluent API для работы с нодами
schema.node(buttonClick3.uuid).pin("buttonName").wireTo(switchNode3, "value");
schema.node(buttonClick3.uuid).pin("next").wireTo(switchNode3, "");

// Обновление пина через fluent API
schema.addExecPinOut(switchNode3.uuid);
const playButtonPin = schema.node(switchNode3.uuid).pin("Case 1");
playButtonPin.update({ name: "PlayButton" });

// Подключение через fluent API
schema.node(switchNode3.uuid).pin("PlayButton").wireTo(log3, "start");

// ============================================
// Вариант 4: Fluent API при создании нод
// ============================================

// Методы create* возвращают FluentNodeBuilder, позволяя сразу подключать пины
const buttonClick4 = schema.createEvent("onButtonClick");
const switchNode4 = schema.createFunction("SwitchString");
const log4 = schema.createFunction("LogAction");

// Цепочка вызовов при создании
buttonClick4.wire("buttonName", switchNode4, "value").wire("next", switchNode4, "");

// Или создание и подключение в одной цепочке
schema.createEvent("onButtonClick").wire("buttonName", switchNode4, "value");

// ============================================
// Вариант 5: Комбинирование разных подходов
// ============================================

const buttonClick5 = schema.createEvent("onButtonClick");
const switchNode5 = schema.createFunction("SwitchString");
const log5 = schema.createFunction("LogAction");
const log6 = schema.createFunction("LogAction");

// Смешиваем разные подходы для максимальной гибкости
schema.wire(buttonClick5, "buttonName", switchNode5, "value"); // Упрощенный синтаксис
schema.node(buttonClick5.uuid).pin("next").wireTo(switchNode5, ""); // Fluent API

// Добавляем динамические пины
schema.addExecPinOut(switchNode5.uuid);
schema.addExecPinOut(switchNode5.uuid);

// Переименовываем используя getPin
const case1Pin = schema.getPin(switchNode5.uuid, "Case 1");
schema.updatePin(case1Pin.uuid, { name: "PlayButton" });

// Подключаем разными способами
schema.wire(switchNode5, "PlayButton", log5, "start"); // Упрощенный синтаксис
schema
  .node(switchNode5.uuid)
  .pin("Case 2")
  .update({ name: "SettingsButton" })
  .wireTo(log6, "start"); // Fluent API

// ============================================
// Дополнительные возможности
// ============================================

// Получение пина через getPin (вместо getNodePins().find())
const pin = schema.getPin(switchNode.uuid, "PlayButton");
console.log("Pin found:", pin.name, pin.type);

// Использование UUID напрямую (все методы поддерживают и UUID, и инстансы)
schema.wire(buttonClick.uuid, "buttonName", switchNode.uuid, "value");

// Fluent API с обновлением пина
schema.node(switchNode.uuid).pin("PlayButton").update({ name: "NewPlayButton" });

// ============================================
// Обратная совместимость - старый API все еще работает
// ============================================

const buttonClickOld = schema.createEvent("onButtonClick");
const switchNodeOld = schema.createFunction("SwitchString");

// Старый способ (все еще работает)
const oldPin1 = schema.getNodePins(buttonClickOld.uuid).find((p) => p.name === "buttonName");
const oldPin2 = schema.getNodePins(switchNodeOld.uuid).find((p) => p.name === "value");
if (oldPin1 && oldPin2) {
  schema.wire(oldPin1.uuid, oldPin2.uuid);
}

// ============================================
// Результат
// ============================================

console.log(
  "SwitchString pins:",
  schema.getNodePins(switchNode.uuid).map((p) => p.name),
);
// ["value", "", "Default", "PlayButton", "SettingsButton"]

// ============================================
// Сравнение: старый vs новый API
// ============================================

// СТАРЫЙ СПОСОБ (3 строки):
// const pin1 = schema.getNodePins(node1.uuid).find((p) => p.name === "pin1");
// const pin2 = schema.getNodePins(node2.uuid).find((p) => p.name === "pin2");
// schema.wire(pin1.uuid, pin2.uuid);

// НОВЫЙ СПОСОБ (1 строка):
// schema.wire(node1, "pin1", node2, "pin2");

// ИЛИ ЧЕРЕЗ FLUENT API (еще более читаемо):
// schema.node(node1.uuid).pin("pin1").wireTo(node2, "pin2");

// ИЛИ ПРИ СОЗДАНИИ НОДЫ:
// schema.createEvent("onClick").wire("x", node2, "input");
