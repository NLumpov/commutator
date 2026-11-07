import { expect, test } from "bun:test";
import { CommonDataType, Commutator } from "../commutator";

function fixture() {
  let callbacks = 0;
  const commutator = Commutator.initialize()
    .defineEvent("start", {
      pinsOut: { value: { type: CommonDataType.Any } },
      execPinsOut: { next: null },
    })
    .defineFunction("count", {
      pinsIn: {}, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: {},
      meta: { type: CommonDataType.Object, properties: { count: { type: CommonDataType.Number } } },
      exec: async ({ meta, exec }) => {
        callbacks++;
        await exec({ pinsOut: {}, execPinOut: null, meta: { count: (meta?.count ?? 0) + 1 } });
      },
    });
  const schema = commutator.createSchema();
  schema.createEvent("start").wire("next", schema.createFunction("count"), "in");
  return { schema, commutator, callbacks: () => callbacks };
}

test("snapshot JSON roundtrip restores without callbacks and separates nested data", async () => {
  const { schema, commutator, callbacks } = fixture();
  const worker = schema.createWorker();
  await worker.triggerEvent("start", { value: { nested: [1] } });
  const baseline = worker.extract();
  expect(Object.keys(baseline)).toEqual(["pinCache", "metaCache"]);
  const restored = commutator.createSchema(schema.extract()).createWorker(JSON.parse(JSON.stringify(baseline)));
  expect(callbacks()).toBe(1);
  expect(restored.extract()).toEqual(baseline);
  baseline.pinCache[0]!.cache.nested.push(2);
  baseline.metaCache[0]!.cache.count = 99;
  expect(worker.extract().pinCache[0]!.cache).toEqual({ nested: [1] });
  const input = worker.extract();
  const isolated = schema.createWorker(input);
  input.pinCache[0]!.cache.nested.push(3);
  const extracted = isolated.extract();
  extracted.metaCache[0]!.cache.count = 100;
  expect(isolated.extract()).toEqual(worker.extract());
});

test("rejects damaged, unknown, duplicate, non-JSON and invalid typed snapshot records", async () => {
  const { schema } = fixture();
  const worker = schema.createWorker();
  await worker.triggerEvent("start", { value: { nested: [1] } });
  const baseline = worker.extract();
  const invalid = [
    { pinCache: [] },
    { metaCache: [] },
    { pinCache: null, metaCache: [] },
    { pinCache: [], metaCache: {} },
    { ...baseline, extra: true },
    { ...baseline, pinCache: [...baseline.pinCache, ...baseline.pinCache] },
    { ...baseline, pinCache: [{ uuid: "unknown", cache: 1 }] },
    { ...baseline, metaCache: [{ ...baseline.metaCache[0], cache: { count: "bad" } }] },
  ];
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const cache of [NaN, Infinity, undefined, () => 1, Promise.resolve(1), cycle, new Date(), { a: undefined }, [, 1]]) {
    invalid.push({ ...baseline, pinCache: [{ ...baseline.pinCache[0]!, cache }] });
  }
  for (const snapshot of invalid) expect(() => schema.createWorker(snapshot as never)).toThrow();
  expect(() => fixture().schema.createWorker(baseline)).toThrow();
});

test("the caller discards cache state and Workers after changing graph topology", async () => {
  const { schema, callbacks } = fixture();
  const worker = schema.createWorker();
  await worker.triggerEvent("start", { value: { nested: [1] } });
  const baseline = worker.extract();
  const graph = schema.extract();
  const event = graph.nodes.find((node) => node.name === "start")!;
  const count = graph.nodes.find((node) => node.name === "count")!;
  schema.unwire({ from: { node: event.uuid, pin: "next" }, to: { node: count.uuid, pin: "in" } });

  // Cache records remain valid; the library does not detect changed topology.
  expect(schema.createWorker(baseline).extract()).toEqual(baseline);
  // The caller invalidates both the saved state and the existing Worker.
  const freshWorker = schema.createWorker();
  expect(freshWorker.extract()).toEqual({ pinCache: [], metaCache: [] });
  await freshWorker.triggerEvent("start", { value: 2 });
  expect(callbacks()).toBe(1);
  expect(freshWorker.extract().metaCache).toEqual([]);
});

test("Worker snapshots serialize cache values without traversing graph configuration", () => {
  const schema = Commutator.initialize().defineFunction("read", {
    config: { type: CommonDataType.Any },
    pinsIn: { value: { type: CommonDataType.Any } }, pinsOut: {},
    execPinsIn: { in: null }, execPinsOut: {}, exec: async () => {},
  }).createSchema();
  const node = schema.createFunction("read");
  const worker = schema.createWorker();
  const baseline = worker.extract();
  let reads = 0;
  const config = Object.defineProperty({}, "value", {
    enumerable: true, get() { reads++; throw new Error("configuration must not be serialized"); },
  });
  schema.updateNodeConfig(node.instance.uuid, config);
  schema.setPinDefaultValue(schema.getPin(node.instance.uuid, "value").uuid, { value: undefined });
  expect(worker.extract()).toEqual(baseline);
  expect(schema.createWorker(baseline).extract()).toEqual(baseline);
  expect(reads).toBe(0);
});

test("extract rejects non-JSON cache values and restore checks cache ownership", async () => {
  const { schema } = fixture();
  // A callback can still produce invalid JSON internally; extract must reject it.
  const outputSchema = Commutator.initialize()
    .defineEvent("run", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("produce", {
      pinsIn: {}, pinsOut: { value: { type: CommonDataType.Any } },
      execPinsIn: { in: null }, execPinsOut: {},
      exec: async ({ exec }) => exec({ pinsOut: { value: NaN }, meta: null, execPinOut: null }),
    }).createSchema();
  outputSchema.createEvent("run").wire("next", outputSchema.createFunction("produce"), "in");
  const invalidWorker = outputSchema.createWorker();
  await invalidWorker.triggerEvent("run", {});
  expect(() => invalidWorker.extract()).toThrow("non-JSON");
  const snapshot = schema.createWorker().extract();
  const graph = schema.extract();
  const execPin = graph.pinInstances.find((pin) => pin.dataType === null)!;
  expect(() => schema.createWorker({ ...snapshot, pinCache: [{ uuid: execPin.uuid, cache: null }] })).toThrow();
  const event = graph.nodes.find((node) => node.name === "start")!;
  expect(() => schema.createWorker({ ...snapshot, metaCache: [{ uuid: event.uuid, cache: null }] })).toThrow();
  const count = graph.nodes.find((node) => node.name === "count")!;
  expect(() => schema.createWorker({ ...snapshot, metaCache: [
    { uuid: count.uuid, cache: { count: 1 } }, { uuid: count.uuid, cache: { count: 2 } },
  ] })).toThrow();
  const getter = Object.defineProperty({}, "value", { enumerable: true, get() { throw new Error("must not run"); } });
  expect(() => schema.createWorker({ ...snapshot, pinCache: [{ uuid: "missing", cache: getter }] })).toThrow("accessor");
});

test("JSON boundaries reject custom array prototypes instead of silently converting them", async () => {
  class CustomArray extends Array<number> {}
  let output: unknown = [1, 2];
  const schema = Commutator.initialize()
    .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("produce", {
      pinsIn: {}, pinsOut: { value: { type: CommonDataType.Any } },
      execPinsIn: { in: null }, execPinsOut: {},
      exec: async ({ exec }) => exec({ pinsOut: { value: output }, meta: null, execPinOut: null }),
    }).createSchema();
  schema.createEvent("start").wire("next", schema.createFunction("produce"), "in");
  const worker = schema.createWorker();
  await worker.triggerEvent("start", {});
  const baseline = worker.extract();
  expect(schema.createWorker(baseline).extract()).toEqual(baseline);
  baseline.pinCache[0]!.cache = new CustomArray(1, 2);
  expect(() => schema.createWorker(baseline)).toThrow("non-JSON");
  output = new CustomArray(1, 2);
  await worker.triggerEvent("start", {});
  expect(() => worker.extract()).toThrow("non-JSON");
});
