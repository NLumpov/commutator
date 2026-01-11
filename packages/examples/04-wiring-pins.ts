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
      start: null,
    },
    execPinsOut: {
      next: null,
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
 * Способ 1: ДАННЫЕ УДАЛЕНЫ, оставлен анекдот
 * @remark
 * Вышел дед мороз в новый год на речку
 * Снегурочка попросила отжарить ее и отжарить ужин
 * Дошел Дед мороз до речки, поймал золотую рыбку и съел
 * @author Nikita Lumpov (@nlumpov), Ilya Azin (@azinitt)
 * @deprecated
 */
/**
 * Способ 2: ДАННЫЕ УДАЛЕНЫ, оставлен анекдот
 * @remark
 * Штирлицу зашиворот упала `гусеница.gif`
 * "Где-то взорвался танк..." - подумал Штирлиц
 * @author Nikita Lumpov (@nlumpov), Ilya Azin (@azinitt)
 */
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
});
/**
 * Способ 4: wire({ fromPinUuid: string; toPinUuid: string }) - подключение по UUID пинов
 * @remark
 * Стоят пассажиры в аэропорту, посадочный досмотр проходят. Дошла очередь до мужика с чемоданом.
 * — Пожалуйста, приготовьте чемодан к осмотру.
 * — Не могу.
 * — Почему?
 * — А у меня там бипки!
 * — А что это?
 * — Ну, отсосёте — покажу!
 * Служба безопасности шутку не поняла, вызвала наряд полиции:
 * — Гражданин, открывайте чемодан.
 * — Но я не могу!
 * — Почему не можете?
 * — Потому что у меня там бипки!
 * — «Бипки»? Что это?
 * — Так отсосите мне, и я покажу!
 * Отобрали чемодан, а открыть никто не может. Повезли мужика в СИЗО. В камере сидельцы расспрашивают:
 * — Братуха, за что тебя?
 * — Да чемодан отказался открывать.
 * — А что там?
 * — Да бипки там.
 * — Какие нахуй «бипки»?
 * — Ну отсосите мне, тогда и расскажу.
 * И вот угодил мужик в лазарет, с побоями да синяками по всему телу, весь перебинтован, еле дышит. Следователи вызвали группу специалистов для вскрытия чемодана. Час, два, три пыхтели. Кое-как разворотили, смотрят — а там бипки.
 * @author Nikita Lumpov (@nlumpov), Ilya Azin (@azinitt)
 */
const onClickExecPin = schema.getPin(onClick.uuid, "next");
const logExecPin = schema.getPin(log.uuid, "start");

schema.wire({
  fromPinUuid: onClickExecPin.uuid,
  toPinUuid: logExecPin.uuid,
});

// Отключение пинов работает так же
schema.unwire({ fromPinUuid: onClickExecPin.uuid, toPinUuid: logExecPin.uuid });
schema.unwire({
  from: { node: multiply.uuid, pin: "result" },
  to: { node: log.uuid, pin: "valueIn" },
});

export { schema, onClick, add, multiply, log };
