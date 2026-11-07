import { expect, spyOn, test } from "bun:test";
import { CommonDataType, Commutator, type Field } from "../commutator";

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
  expect(baseline).toHaveProperty("schemaFingerprint");
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

test("rejects damaged, foreign, duplicate, non-JSON and invalid typed snapshot records", async () => {
  const { schema } = fixture();
  const worker = schema.createWorker();
  await worker.triggerEvent("start", { value: { nested: [1] } });
  const baseline = worker.extract();
  const invalid = [
    { pinCache: [], metaCache: [] },
    { ...baseline, schemaFingerprint: "foreign" },
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

test("fingerprint observes live graph array order and config values without owning Schema data", () => {
  const { schema, commutator } = fixture();
  schema.createEvent("start");
  const snapshot = schema.createWorker().extract();
  const graph = schema.extract();
  const reversed = commutator.createSchema({ ...graph, nodes: [...graph.nodes].reverse() });
  expect(() => reversed.createWorker(snapshot)).toThrow("schema mismatch");
  const reversedPins = commutator.createSchema({ ...graph, pinInstances: [...graph.pinInstances].reverse() });
  expect(() => reversedPins.createWorker(snapshot)).toThrow("schema mismatch");
  const worker = schema.createWorker();
  const node = graph.nodes[0]!;
  Object.assign(node, { config: { values: [1, 2] } });
  const first = worker.extract();
  Object.assign(node, { config: { values: [2, 1] } });
  expect(worker.extract().schemaFingerprint).not.toBe(first.schemaFingerprint);
  expect(() => schema.createWorker(first)).toThrow("schema mismatch");
});

test("extract rejects non-JSON cache values and restore checks cache ownership", async () => {
  const { schema } = fixture();
  const worker = schema.createWorker();
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

for (const field of [
  { type: CommonDataType.Any, name: undefined },
  { type: CommonDataType.Object, name: undefined, properties: {
    values: { type: CommonDataType.Array, name: undefined, itemType: { type: CommonDataType.Number, name: undefined } },
  } },
] satisfies Field<{}>[]) {
  for (const location of ["pin", "meta", "dataType"] as const) {
    test(`fingerprint accepts optional undefined names in ${location} ${field.type} descriptors`, () => {
      const schema = Commutator.initialize()
        .defineDataType("Payload", location === "dataType" ? field : { type: CommonDataType.Any })
        .defineEvent("start", { pinsOut: { value: location === "pin" ? field : { type: "Payload" } }, execPinsOut: {} })
        .defineFunction("read", {
          pinsIn: {}, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: {},
          meta: location === "meta" ? field : { type: CommonDataType.Any },
          exec: async () => {},
        }).createSchema();
      const event = schema.createEvent("start");
      schema.createFunction("read");
      const baseline = schema.createWorker().extract();
      expect(schema.createWorker(baseline).extract()).toEqual(baseline);
      expect(Object.hasOwn(field, "name")).toBe(true);
      expect(field.name).toBeUndefined();
      const pin = schema.getPin(event.instance.uuid, "value");
      if (pin.dataType) pin.dataType.name = "visible name";
      expect(schema.createWorker().extract().schemaFingerprint).not.toBe(baseline.schemaFingerprint);
      expect(() => schema.createWorker(baseline)).toThrow("schema mismatch");
      // Definitions and pins stay live; restore the shared fixture for the next location.
      if (pin.dataType) pin.dataType.name = undefined;
    });
  }
}

test("descriptor normalization does not erase undefined in user config or pin defaults", () => {
  const schema = Commutator.initialize()
    .defineFunction("read", {
      config: { type: CommonDataType.Any, name: undefined },
      pinsIn: { value: { type: CommonDataType.Any, name: undefined } }, pinsOut: {},
      execPinsIn: { in: null }, execPinsOut: {}, exec: async () => {},
    }).createSchema();
  const node = schema.createFunction("read");
  const worker = schema.createWorker();
  const baseline = worker.extract();
  schema.updateNodeConfig(node.instance.uuid, { nested: { value: undefined } });
  expect(() => worker.extract()).toThrow("non-JSON");
  schema.updateNodeConfig(node.instance.uuid, null);
  schema.setPinDefaultValue(schema.getPin(node.instance.uuid, "value").uuid, { nested: { value: undefined } });
  expect(() => worker.extract()).toThrow("non-JSON");
  expect(baseline.pinCache).toEqual([]);
});

test("descriptor normalization rejects cycles and retains unsupported descriptors for JSON validation", () => {
  const field: Field<{}> = { type: CommonDataType.Object, properties: {} };
  const schema = Commutator.initialize()
    .defineEvent("start", { pinsOut: { value: field }, execPinsOut: {} }).createSchema();
  schema.createEvent("start");
  const worker = schema.createWorker();
  field.properties.self = field;
  expect(() => worker.extract()).toThrow("cyclic field");
  delete field.properties.self;
  Object.defineProperty(field, "name", { enumerable: true, configurable: true, get() { throw new Error("getter executed"); } });
  expect(() => worker.extract()).toThrow("accessor");
  delete field.name;
  Object.defineProperty(field, "hidden", { value: undefined });
  expect(() => worker.extract()).toThrow("hidden property");
});

test("extract computes graph identity once per call and still observes every live mutation", () => {
  const { schema } = fixture();
  const worker = schema.createWorker();
  const identity = spyOn(Object.getPrototypeOf(worker), "schemaFingerprint");
  try {
    const first = worker.extract();
    expect(identity).toHaveBeenCalledTimes(1);
    const node = schema.extract().nodes[0]!;
    Object.assign(node, { config: { changed: 1 } });
    const second = worker.extract();
    expect(identity).toHaveBeenCalledTimes(2);
    expect(second.schemaFingerprint).not.toBe(first.schemaFingerprint);
    expect(() => schema.createWorker(first)).toThrow("schema mismatch");
    expect(identity).toHaveBeenCalledTimes(3);
    expect(schema.createWorker(second).extract()).toEqual(second);
    expect(identity).toHaveBeenCalledTimes(5);
  } finally {
    identity.mockRestore();
  }
});

test("canonical graph projection preserves object identity across key order and detects live leaf changes", () => {
  const { schema } = fixture();
  const worker = schema.createWorker();
  const graph = schema.extract();
  const node = graph.nodes[0]!;
  const pin = graph.pinInstances.find((pin) => pin.dataType !== null)!;
  Object.assign(node, { config: { z: [1, 2], a: { second: 2, first: 1 } } });
  const first = worker.extract();
  Object.assign(node, { config: { a: { first: 1, second: 2 }, z: [1, 2] } });
  expect(worker.extract().schemaFingerprint).toBe(first.schemaFingerprint);
  expect(schema.createWorker(first).extract()).toEqual(first);
  Object.assign(pin.dataType!, { name: "changed after fingerprint" });
  const second = worker.extract();
  expect(second.schemaFingerprint).not.toBe(first.schemaFingerprint);
  expect(() => schema.createWorker(first)).toThrow("schema mismatch");
  Object.assign(graph.wires[0]!, { annotation: { later: 2, earlier: 1 } });
  const third = worker.extract();
  Object.assign(graph.wires[0]!, { annotation: { earlier: 1, later: 2 } });
  expect(worker.extract().schemaFingerprint).toBe(third.schemaFingerprint);
  expect(third.schemaFingerprint).not.toBe(second.schemaFingerprint);
});

test("canonical graph projection rejects non-JSON live values and never evaluates leaf getters", () => {
  const { schema } = fixture();
  const worker = schema.createWorker();
  const baseline = worker.extract();
  const graph = schema.extract();
  let reads = 0;
  const accessor = Object.defineProperty({}, "value", { enumerable: true, get() { reads++; return 1; } });
  const targets: [object, string][] = [
    [graph.nodes[0]!, "uuid"], [graph.nodes[0]!, "name"], [graph.nodes[0]!, "type"], [graph.nodes[0]!, "config"],
    [graph.pinInstances[0]!, "uuid"], [graph.pinInstances[0]!, "nodeUuid"], [graph.pinInstances[0]!, "name"],
    [graph.pinInstances[0]!, "type"], [graph.pinInstances[0]!, "default"], [graph.wires[0]!, "annotation"],
  ];
  for (const [target, key] of targets) {
    const original = Object.getOwnPropertyDescriptor(target, key);
    try {
      for (const value of [NaN, accessor]) {
        Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
        expect(() => worker.extract()).toThrow();
        expect(() => schema.createWorker(baseline)).toThrow();
      }
    } finally {
      if (original) Object.defineProperty(target, key, original);
      else Reflect.deleteProperty(target, key);
    }
  }
  expect(reads).toBe(0);
  expect(worker.extract()).toEqual(baseline);
});

test("scalar descriptor fast path rejects malformed live Field values", () => {
  const { schema } = fixture();
  const worker = schema.createWorker();
  const baseline = worker.extract();
  const pin = schema.extract().pinInstances.find((pin) => pin.dataType !== null)!;
  const original = pin.dataType;
  for (const dataType of [7, "bad", false, [], () => 1]) {
    Object.assign(pin, { dataType });
    expect(() => worker.extract()).toThrow("non-JSON");
    expect(() => schema.createWorker(baseline)).toThrow("non-JSON");
  }
  pin.dataType = original;
  expect(worker.extract()).toEqual(baseline);
});
