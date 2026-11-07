import { expect, test } from "bun:test";
import { CommonDataType, Commutator } from "../commutator";

test("failed callback cannot mutate caller input or baseline; retry sees the original values", async () => {
  const observed: unknown[] = [];
  const failure = new Error("callback failed");
  let fail = true;
  const commutator = Commutator.initialize()
    .defineDataType("Payload", {
      type: CommonDataType.Object,
      properties: {
        nested: {
          type: CommonDataType.Object,
          properties: { values: { type: CommonDataType.Array, itemType: { type: CommonDataType.Number } } },
        },
      },
    })
    .defineEvent("seed", {
      pinsOut: { value: { type: "Payload" } },
      execPinsOut: {},
    })
    .defineEvent("start", {
      pinsOut: { value: { type: "Payload" } },
      execPinsOut: { next: null },
    })
    .defineFunction("mutate", {
      pinsIn: { input: { type: "Payload" }, previous: { type: "Payload" } },
      pinsOut: {},
      execPinsIn: { in: null },
      execPinsOut: {},
      exec: async ({ pinsIn }) => {
        observed.push(structuredClone(pinsIn));
        pinsIn.input.nested.values.push(2);
        pinsIn.previous.nested.values.push(20);
        if (fail) throw failure;
      },
    });
  const schema = commutator.createSchema();
  const mutate = schema.createFunction("mutate");
  schema.createEvent("seed").wire("value", mutate, "previous");
  schema.createEvent("start").wire("value", mutate, "input").wire("next", mutate, "in");
  const original = schema.createWorker();
  await original.triggerEvent("seed", { value: { nested: { values: [10] } } });
  const baseline = original.extract();
  const baselineBefore = structuredClone(baseline);
  const input = { value: { nested: { values: [1] } } };

  await expect(schema.createWorker(baseline).triggerEvent("start", input)).rejects.toBe(failure);
  expect(input).toEqual({ value: { nested: { values: [1] } } });
  expect(baseline).toEqual(baselineBefore);
  expect(original.extract()).toEqual(baselineBefore);

  fail = false;
  await schema.createWorker(baseline).triggerEvent("start", input);
  expect(observed).toEqual([
    { input: { nested: { values: [1] } }, previous: { nested: { values: [10] } } },
    { input: { nested: { values: [1] } }, previous: { nested: { values: [10] } } },
  ]);
  expect(input).toEqual({ value: { nested: { values: [1] } } });
  expect(baseline).toEqual(baselineBefore);
});

test("boundary copy preserves shared values throughout the Function chain", async () => {
  let firstValue: unknown;
  const commutator = Commutator.initialize()
    .defineDataType("Payload", {
      type: CommonDataType.Object,
      properties: { nested: { type: CommonDataType.Array, itemType: { type: CommonDataType.Number } } },
    })
    .defineEvent("start", {
      pinsOut: { first: { type: "Payload" }, second: { type: "Payload" } },
      execPinsOut: { next: null },
    })
    .defineFunction("first", {
      pinsIn: { value: { type: "Payload" } },
      pinsOut: {},
      execPinsIn: { in: null },
      execPinsOut: { next: null },
      exec: async ({ pinsIn, exec }) => {
        firstValue = pinsIn.value;
        pinsIn.value.nested.push(2);
        await exec({ pinsOut: {}, meta: null, execPinOut: "next" });
      },
    })
    .defineFunction("second", {
      pinsIn: { value: { type: "Payload" } },
      pinsOut: {},
      execPinsIn: { in: null },
      execPinsOut: {},
      exec: async ({ pinsIn }) => {
        expect(firstValue).toBe(pinsIn.value);
        expect(pinsIn.value).toEqual({ nested: [1, 2] });
      },
    });
  const schema = commutator.createSchema();
  const event = schema.createEvent("start");
  const first = schema.createFunction("first");
  const second = schema.createFunction("second");
  event.wire("first", first, "value").wire("second", second, "value").wire("next", first, "in");
  first.wire("next", second, "in");
  const shared = { nested: [1] };
  await schema.createWorker().triggerEvent("start", { first: shared, second: shared });
  expect(firstValue).not.toBe(shared);
  expect(shared).toEqual({ nested: [1] });
});
