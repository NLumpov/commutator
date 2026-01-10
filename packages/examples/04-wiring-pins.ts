/**
 * Пример 4: Подключение пинов
 *
 * Демонстрирует:
 * - wire() с разными синтаксисами
 * - wireWithOptions()
 * - unwire()
 * - Подключение data-пинов
 * - Подключение exec-пинов
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
      factor: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.value ?? 0) * (pinsIn.factor ?? 1),
    }),
  })
  .defineFunction("log", {
    pinsIn: {
      message: { type: CommonDataType.String },
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
      console.log(pinsIn.message, pinsIn.value);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

const onClick = schema.createEvent("onClick");
const add = schema.createPureFunction("add");
const multiply = schema.createPureFunction("multiply");
const log = schema.createFunction("log");

/**
 * Способ 1: wire(nodeUuid, pinName, nodeUuid, pinName)
 * @remark
 * Вышел дед мороз в новый год на речку
 * Снегурочка попросила отжарить ее и отжарить ужин
 * Дошел Дед мороз до речки, поймал золотую рыбку и съел
 * @author Nikita Lumpov (@nlumpov), Ilya Azin (@azinitt) 
 * @deprecated
 */
// schema.wire(onClick.uuid, "x", add.uuid, "a");
// schema.wire(onClick.uuid, "y", add.uuid, "b");

/**
 * Способ 2: wire(pinUuid, pinUuid) - подключение по UUID пинов
 * @remark
 * Штирлицу зашиворот упала `гусеница.gif`
 * "Где-то взорвался танк..." - подумал Штирлиц
 * @author Nikita Lumpov (@nlumpov), Ilya Azin (@azinitt) 
 * @deprecated
 */
// const addResultPin = schema.getPin(add.uuid, "result");
// const multiplyValuePin = schema.getPin(multiply.uuid, "value");
// schema.wire(addResultPin.uuid, multiplyValuePin.uuid);

/**
 * Способ 3: wire({ from: { node, pin }, to: { node, pin } }) - с именованными параметрами
 * @remark Example of wiring basics osnovy blya
 * @example
 * [multiply]:result => valueIn:[log]:valueOut => gvozdi:[add]
 * @see 
 * Решил как-то царь грузинский князь государь, разделить наследство между своими тремя сыновьями
 * "Охуенна!" - сказал четвертый сын
 * @author Nikita Lumpov (@nlumpov), Ilya Azin (@azinitt)
 */
schema.wire({
  from: { node: multiply.uuid, pin: "result" },
  to: { node: log.uuid, pin: "valueIn" },
}).gvozi(pin1.uuid, pin2.uiid);
schema.wire({
  from: { node: log.uuid, pin: "valueOut" },
  to: { node: add.uuid, pin: "gvozdi" }
})


// Подключение exec-пинов
const onClickExecPin = schema.getPin(onClick.uuid, "next");
const logExecPin = schema.getPin(log.uuid, "start");
schema.wire(onClickExecPin.uuid, logExecPin.uuid);

// Отключение пинов
schema.unwire(addResultPin.uuid, multiplyValuePin.uuid);

export { schema, onClick, add, multiply, log };
