import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator } from "../../commutator";
import type { WorkerSnapshot } from "../types";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture(body: (args: any) => Promise<void> = async ({ pinsIn, exec }) => {
  await exec({ pinsOut: { value: pinsIn.value }, execPinOut: "next", meta: null });
}, child: () => Promise<void> = async () => {}) {
  const commutator = Commutator.initialize().configure({ maxSteps: 20 })
    .defineEvent("start", { pinsOut: { value: { type: CommonDataType.Any } }, execPinsOut: { next: null } })
    .defineFunction("A", {
      pinsIn: { value: { type: CommonDataType.Any } }, pinsOut: { value: { type: CommonDataType.Any } },
      execPinsIn: { enter: null }, execPinsOut: { next: null }, exec: body,
    })
    .defineFunction("B", { pinsIn: {}, pinsOut: {}, execPinsIn: { enter: null }, execPinsOut: {}, exec: child });
  const schema = commutator.createSchema();
  const a = schema.createFunction("A");
  const b = schema.createFunction("B");
  schema.createEvent("start").wire("next", a, "enter").wire("value", a, "value");
  a.wire("next", b, "enter");
  return { commutator, schema, a, b };
}

describe("completed trigger boundaries", () => {
  test("busy rejections preserve the active trigger, including callback tails and child drain", async () => {
    const gate = deferred();
    const trace: string[] = [];
    const { schema } = fixture(async ({ exec }) => {
      trace.push("A");
      void exec({ pinsOut: { value: 1 }, execPinOut: "next", meta: null });
      trace.push("tail");
    }, async () => { trace.push("B"); await gate.promise; trace.push("B:done"); });
    const worker = schema.createWorker();
    const running = worker.triggerEvent("start", { value: 0 });
    try {
      expect(trace).toEqual(["A", "B", "tail"]);
      expect(() => worker.extract()).toThrow("WORKER_BUSY");
      await expect(worker.triggerEvent("start", { value: 99 })).rejects.toHaveProperty("code", "WORKER_BUSY");
      expect(() => worker.extract()).toThrow("WORKER_BUSY");
    } finally { gate.resolve(); }
    await running;
    expect(trace).toEqual(["A", "B", "tail", "B:done"]);
    expect(worker.extract().pinCache.map(({ cache }) => cache)).toEqual([0, 1]);
    await worker.triggerEvent("start", { value: 2 });
  });

  test("own failure waits for children, then permanently rejects trigger/extract", async () => {
    const gate = deferred();
    let finished = false;
    let settled = false;
    const { schema } = fixture(async ({ exec }) => {
      void exec({ pinsOut: { value: 1 }, execPinOut: "next", meta: null });
      throw new Error("parent failure");
    }, async () => { await gate.promise; finished = true; });
    const worker = schema.createWorker();
    const running = worker.triggerEvent("start", { value: 0 }).catch((error) => { settled = true; return error; });
    try {
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(settled).toBe(false);
      expect(() => worker.extract()).toThrow("WORKER_BUSY");
    } finally { gate.resolve(); }
    expect(await running).toHaveProperty("message", "parent failure");
    expect(finished).toBe(true);
    expect(() => worker.extract()).toThrow("WORKER_FAILED");
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "WORKER_FAILED");
  });

  for (const failure of [false, true]) test(`late exec cannot mutate closed context, failed=${failure}`, async () => {
    let late!: (args: any) => Promise<void>;
    let calls = 0;
    const { schema } = fixture(async ({ exec }) => {
      late = exec;
      await exec({ pinsOut: { value: 1 }, execPinOut: "next", meta: null });
      if (failure) throw new Error("failure");
    }, async () => { calls++; });
    const worker = schema.createWorker();
    const result = worker.triggerEvent("start", { value: 0 });
    if (failure) await expect(result).rejects.toThrow("failure");
    else await result;
    const before = failure ? undefined : worker.extract();
    await expect(late({ pinsOut: { value: 99 }, execPinOut: "next", meta: 99 })).rejects.toHaveProperty("code", "EXEC_CLOSED");
    expect(calls).toBe(1);
    if (before) expect(worker.extract()).toEqual(before);
  });
});

describe("independent finite JSON snapshots", () => {
  test("input, extracted caches and restore baseline have independent nested objects", async () => {
    let mutate = false;
    const seen: number[] = [];
    const { schema } = fixture(async ({ pinsIn, exec }) => {
      seen.push(pinsIn.value.nested.count);
      if (mutate) pinsIn.value.nested.count++;
      await exec({ pinsOut: { value: pinsIn.value }, execPinOut: null, meta: null });
    });
    const worker = schema.createWorker();
    const input = { value: { nested: { count: 7 } } };
    await worker.triggerEvent("start", input);
    const baseline = worker.extract();
    mutate = true;
    const restored = schema.createWorker(baseline);
    (baseline.pinCache[0]!.cache as any).nested.count = 88;
    expect((restored.extract().pinCache[0]!.cache as any).nested.count).toBe(7);
    const extracted = restored.extract();
    (extracted.pinCache[0]!.cache as any).nested.count = 99;
    expect((restored.extract().pinCache[0]!.cache as any).nested.count).toBe(7);
    await restored.triggerEvent("start", input);
    await schema.createWorker(worker.extract()).triggerEvent("start", input);
    expect(input.value.nested.count).toBe(7);
    expect(seen).toEqual([7, 7, 7]);
    expect((worker.extract().pinCache[0]!.cache as any).nested.count).toBe(7);
    expect(schema.createWorker(JSON.parse(JSON.stringify(restored.extract()))).extract()).toEqual(restored.extract());
  });

  test("snapshot mutation in callback cannot change caller baseline", async () => {
    let mutate = false;
    const commutator = Commutator.initialize()
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("State", { pinsIn: {}, pinsOut: {}, execPinsIn: { enter: null }, execPinsOut: {},
        meta: { type: CommonDataType.Object, properties: { count: { type: CommonDataType.Number } } },
        exec: async ({ meta, exec }) => { if (mutate && meta) (meta as { count: number }).count = 100; await exec({ pinsOut: {}, execPinOut: null, meta: meta ?? { count: 1 } }); },
      });
    const schema = commutator.createSchema();
    schema.createEvent("start").wire("next", schema.createFunction("State"), "enter");
    const worker = schema.createWorker();
    await worker.triggerEvent("start", {});
    const baseline = worker.extract();
    const before = JSON.stringify(baseline);
    mutate = true;
    await schema.createWorker(baseline).triggerEvent("start", {});
    expect(JSON.stringify(baseline)).toBe(before);
  });

  const cycle: any = {}; cycle.self = cycle;
  const accessor = Object.defineProperty({}, "x", { enumerable: true, get() { throw new Error("getter ran"); } });
  for (const invalid of [undefined, NaN, Infinity, -Infinity, () => {}, 1n, Promise.resolve(), cycle, new Date(), new Map(), [, 1], { x: undefined }, accessor, { [Symbol("x")]: 1 }]) {
    test(`rejects non-JSON at input/restore/extract: ${String(typeof invalid)}`, async () => {
      const { schema } = fixture();
      await expect(schema.createWorker().triggerEvent("start", { value: invalid })).rejects.toHaveProperty("code", "INVALID_JSON");
      const snapshot = schema.createWorker().extract();
      expect(() => schema.createWorker({ ...snapshot, metaCache: [{ uuid: "bad", cache: invalid }] } as WorkerSnapshot)).toThrow("INVALID_JSON");
      const { schema: outputSchema } = fixture(async ({ exec }) => { await exec({ pinsOut: { value: invalid }, execPinOut: null, meta: null }); });
      const outputWorker = outputSchema.createWorker();
      await outputWorker.triggerEvent("start", { value: null });
      // Undefined output means "not supplied" in the existing output API.
      if (invalid !== undefined) expect(() => outputWorker.extract()).toThrow("INVALID_JSON");
    });
  }

  test("rejects malformed/duplicate/unknown/type-invalid caches before restore", async () => {
    const { schema, a } = fixture();
    const worker = schema.createWorker();
    await worker.triggerEvent("start", { value: 1 });
    const baseline = worker.extract();
    const event = schema.extract().nodes.find((node) => node.name === "start")!;
    const bad: unknown[] = [null, {}, [], { ...baseline, extra: 1 }, { ...baseline, pinCache: {} },
      { ...baseline, pinCache: [baseline.pinCache[0], baseline.pinCache[0]] },
      { ...baseline, pinCache: [{ uuid: "missing", cache: 1 }] },
      { ...baseline, pinCache: [{ uuid: schema.getPin(a.uuid, "enter").uuid, cache: 1 }] },
      { ...baseline, pinCache: [{ uuid: schema.getPin(a.uuid, "value").uuid, cache: 1, extra: 1 }] },
      { ...baseline, metaCache: [{ uuid: a.uuid, cache: 7 }] },
      { ...baseline, metaCache: [{ uuid: "missing", cache: null }] },
      { ...baseline, metaCache: [{ uuid: event.uuid, cache: null }] },
    ];
    for (const candidate of bad) expect(() => schema.createWorker(candidate as WorkerSnapshot)).toThrow("INVALID_SNAPSHOT");
    expect(schema.createWorker(baseline).extract()).toEqual(baseline);
  });

  test("fingerprint preserves graph arrays but ignores object property order", () => {
    const { commutator, schema } = fixture();
    schema.createEvent("start");
    const graph = schema.extract();
    const baseline = schema.createWorker().extract();
    const reorderKeys = (value: any): any => Array.isArray(value) ? value.map(reorderKeys)
      : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorderKeys(item)])) : value;
    expect(commutator.createSchema(reorderKeys(graph)).createWorker(baseline).extract()).toEqual(baseline);
    for (const key of ["nodes", "pinInstances", "wires"] as const) {
      const changed = structuredClone(graph);
      changed[key].reverse();
      expect(() => commutator.createSchema(changed).createWorker(baseline)).toThrow("SCHEMA_MISMATCH");
    }
    const other = fixture().schema;
    expect(() => other.createWorker(baseline)).toThrow("SCHEMA_MISMATCH");
    expect(() => schema.createWorker({ ...baseline, schemaFingerprint: "wrong" })).toThrow("SCHEMA_MISMATCH");
  });

  test("fingerprint observes nested direct edits, API edits and later restores", () => {
    const { schema } = fixture();
    const worker = schema.createWorker();
    const graph = schema.extract();
    const pin = graph.pinInstances.find((item) => item.dataType !== null)!;
    pin.default = { nested: { count: 1 } };
    const first = worker.extract();
    expect(schema.createWorker(first).extract()).toEqual(first);
    (pin.default as any).nested.count = 2;
    const second = worker.extract();
    expect(second.schemaFingerprint).not.toBe(first.schemaFingerprint);
    expect(() => schema.createWorker(first)).toThrow("SCHEMA_MISMATCH");
    expect(schema.createWorker(second).extract()).toEqual(second);
    const wire = graph.wires[0]!;
    schema.unwire({ fromPinUuid: wire.from, toPinUuid: wire.to });
    expect(worker.extract().schemaFingerprint).not.toBe(second.schemaFingerprint);
  });

  test("extract refuses typed caches corrupted in place by a callback", async () => {
    let corrupt = false;
    const commutator = Commutator.initialize()
      .defineEvent("start", { pinsOut: { value: { type: CommonDataType.Object, properties: { count: { type: CommonDataType.Number } } } }, execPinsOut: { next: null } })
      .defineFunction("State", { pinsIn: { value: { type: CommonDataType.Any } }, pinsOut: {}, execPinsIn: { enter: null }, execPinsOut: {},
        meta: { type: CommonDataType.Object, properties: { count: { type: CommonDataType.Number } } },
        exec: async ({ pinsIn, meta, exec }) => {
          if (corrupt) { (meta as any).count = "invalid"; (pinsIn.value as any).count = "invalid"; return; }
          await exec({ pinsOut: {}, execPinOut: null, meta: { count: 1 } });
        },
      });
    const schema = commutator.createSchema();
    const state = schema.createFunction("State");
    schema.createEvent("start").wire("next", state, "enter").wire("value", state, "value");
    const worker = schema.createWorker();
    await worker.triggerEvent("start", { value: { count: 1 } });
    const baseline = worker.extract();
    corrupt = true;
    await worker.triggerEvent("start", { value: { count: 2 } });
    expect(() => worker.extract()).toThrow("INVALID_SNAPSHOT");
    expect(schema.createWorker(baseline).extract()).toEqual(baseline);
  });

  test("fingerprint refuses non-finite/coercing schema data before cache comparison", () => {
    const { schema } = fixture();
    const worker = schema.createWorker();
    const pin = schema.extract().pinInstances.find((item) => item.dataType !== null)!;
    pin.default = null;
    const baseline = worker.extract();
    for (const value of [NaN, Infinity, -Infinity, () => {}, 1n, new Date(), Object.assign([1], { extra: true }), [, 1], { [Symbol("x")]: 1 }]) {
      pin.default = value;
      expect(() => worker.extract()).toThrow("INVALID_JSON");
      expect(() => schema.createWorker(baseline)).toThrow("INVALID_JSON");
    }
    let called = false;
    pin.default = { toJSON() { called = true; return null; } };
    expect(() => worker.extract()).toThrow("INVALID_JSON");
    expect(called).toBe(false);
    pin.default = Object.defineProperty({}, "toJSON", { get() { called = true; return () => null; } });
    expect(() => worker.extract()).toThrow("INVALID_JSON");
    expect(called).toBe(false);
    pin.default = Object.defineProperty({}, "value", { enumerable: true, get() { called = true; return null; } });
    expect(() => worker.extract()).toThrow("INVALID_JSON");
    expect(called).toBe(false);
    const circular: any = {}; circular.self = circular; pin.default = circular;
    expect(() => worker.extract()).toThrow("INVALID_JSON");
    pin.default = null;
    expect(worker.extract()).toEqual(baseline);
  });

  test("plain JSON special keys and null prototypes stay safe and detached", async () => {
    const { schema } = fixture();
    const worker = schema.createWorker();
    const input = { value: JSON.parse('{"__proto__":{"polluted":true},"constructor":"data"}') };
    Object.setPrototypeOf(input.value, null);
    await worker.triggerEvent("start", input);
    const snapshot = worker.extract();
    expect(Object.getPrototypeOf(snapshot.pinCache[0]!.cache)).toBe(Object.prototype);
    expect(Object.hasOwn(snapshot.pinCache[0]!.cache as object, "__proto__")).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
    expect(schema.createWorker(snapshot).extract()).toEqual(snapshot);
  });

  test("invalid typed meta cannot produce an unrestorable successful snapshot", async () => {
    const { schema } = fixture(async ({ exec }) => { await exec({ pinsOut: {}, execPinOut: null, meta: 7 }); });
    await expect(schema.createWorker().triggerEvent("start", {})).rejects.toThrow("Invalid meta");
  });
});
