import { expect, test } from "bun:test";
import { CommonDataType, Commutator } from "../commutator";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => { resolve = finish; });
  return { promise, resolve };
}

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("busy calls reject before reading input and do not poison the active trigger", async () => {
  const gate = deferred();
  const seen: unknown[] = [];
  const schema = Commutator.initialize()
    .defineEvent("start", { pinsOut: { value: { type: CommonDataType.Number } }, execPinsOut: { next: null } })
    .defineFunction("read", {
      pinsIn: { value: { type: CommonDataType.Number } }, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: {},
      exec: async ({ pinsIn }) => { await gate.promise; seen.push(pinsIn.value); },
    }).createSchema();
  const node = schema.createFunction("read");
  schema.createEvent("start").wire("next", node, "in").wire("value", node, "value");
  const worker = schema.createWorker();
  const running = worker.triggerEvent("start", { value: 1 });
  let reads = 0;
  try {
    expect(() => worker.extract()).toThrow("WORKER_BUSY");
    await expect(worker.triggerEvent("start", { get value() { reads++; return 2; } })).rejects.toHaveProperty("code", "WORKER_BUSY");
    expect(reads).toBe(0);
  } finally { gate.resolve(); }
  await running;
  await worker.triggerEvent("start", { value: 3 });
  expect(seen).toEqual([1, 3]);
  expect(worker.extract().pinCache.map(({ cache }) => cache)).toEqual([3]);
});

for (const failure of [undefined, new Error("body failed")]) {
  test(`failure becomes terminal only after draining issued children: ${String(failure)}`, async () => {
    const child = deferred();
    let finished = false;
    let settled = false;
    const schema = Commutator.initialize()
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("parent", {
        pinsIn: {}, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: { next: null },
        exec: async ({ exec }) => { void exec({ pinsOut: {}, meta: null, execPinOut: "next" }); throw failure; },
      })
      .defineFunction("child", {
        pinsIn: {}, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: {},
        exec: async () => { await child.promise; finished = true; },
      }).createSchema();
    const parent = schema.createFunction("parent");
    schema.createEvent("start").wire("next", parent, "in");
    parent.wire("next", schema.createFunction("child"), "in");
    const worker = schema.createWorker();
    const outcome = worker.triggerEvent("start", {}).then(() => ({ ok: true, error: undefined }), (error: unknown) => ({ ok: false, error })).finally(() => { settled = true; });
    try {
      await turn();
      expect(settled).toBe(false);
      expect(() => worker.extract()).toThrow("WORKER_BUSY");
      await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "WORKER_BUSY");
    } finally { child.resolve(); }
    expect(await outcome).toEqual({ ok: false, error: failure });
    expect(finished).toBe(true);
    expect(() => worker.extract()).toThrow("WORKER_FAILED");
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "WORKER_FAILED");
  });
}

test("closed exec cannot mutate caches or poison a later active trigger", async () => {
  let oldExec: (() => Promise<void>) | undefined;
  const gate = deferred();
  let visits = 0;
  const schema = Commutator.initialize()
    .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("write", {
      pinsIn: {}, pinsOut: { value: { type: CommonDataType.Number } }, meta: { type: CommonDataType.Number },
      execPinsIn: { in: null }, execPinsOut: {},
      exec: async ({ exec }) => {
        visits++;
        if (visits === 1) oldExec = () => exec({ pinsOut: { value: 99 }, meta: 99, execPinOut: null });
        else await gate.promise;
        await exec({ pinsOut: { value: visits }, meta: visits, execPinOut: null });
      },
    }).createSchema();
  schema.createEvent("start").wire("next", schema.createFunction("write"), "in");
  const worker = schema.createWorker();
  await worker.triggerEvent("start", {});
  if (!oldExec) throw new Error("exec not captured");
  const baseline = worker.extract();
  await expect(oldExec()).rejects.toHaveProperty("code", "EXEC_CONTEXT_CLOSED");
  expect(worker.extract()).toEqual(baseline);
  const running = worker.triggerEvent("start", {});
  try { await expect(oldExec()).rejects.toHaveProperty("code", "EXEC_CONTEXT_CLOSED"); }
  finally { gate.resolve(); }
  await running;
  expect(worker.extract().pinCache.map(({ cache }) => cache)).toEqual([2]);
  expect(worker.extract().metaCache.map(({ cache }) => cache)).toEqual([2]);
});

test("an earlier root's closed exec cannot publish while a later root is still running", async () => {
  let oldExec: (() => Promise<void>) | undefined;
  let visits = 0;
  const secondStarted = deferred(), gate = deferred();
  const schema = Commutator.initialize()
    .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("root", {
      pinsIn: {}, pinsOut: { value: { type: CommonDataType.Number } }, meta: { type: CommonDataType.Number },
      execPinsIn: { in: null }, execPinsOut: {},
      exec: async ({ exec }) => {
        if (++visits === 1) oldExec = () => exec({ pinsOut: { value: 99 }, meta: 99, execPinOut: null });
        else { secondStarted.resolve(); await gate.promise; }
      },
    }).createSchema();
  const root = schema.createFunction("root");
  schema.createEvent("start").wire("next", root, "in");
  schema.createEvent("start").wire("next", root, "in");
  const worker = schema.createWorker();
  const baseline = worker.extract();
  const running = worker.triggerEvent("start", {});
  try {
    await secondStarted.promise;
    if (!oldExec) throw new Error("exec not captured");
    await expect(oldExec()).rejects.toHaveProperty("code", "EXEC_CONTEXT_CLOSED");
  } finally { gate.resolve(); }
  await running;
  expect(worker.extract()).toEqual(baseline);
});

test("trigger waits for native await tails after immediate child entry", async () => {
  const child = deferred(), tail = deferred(), tailStarted = deferred();
  const trace: string[] = [];
  let settled = false;
  const schema = Commutator.initialize()
    .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("parent", {
      pinsIn: {}, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: { next: null },
      exec: async ({ exec }) => {
        trace.push("parent");
        const pending = exec({ pinsOut: {}, meta: null, execPinOut: "next" });
        trace.push("called");
        await pending;
        trace.push("tail"); tailStarted.resolve();
        await tail.promise;
        trace.push("done");
      },
    })
    .defineFunction("child", {
      pinsIn: {}, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: {},
      exec: async () => { trace.push("child"); await child.promise; trace.push("child:done"); },
    }).createSchema();
  const parent = schema.createFunction("parent");
  schema.createEvent("start").wire("next", parent, "in");
  parent.wire("next", schema.createFunction("child"), "in");
  const worker = schema.createWorker();
  const running = worker.triggerEvent("start", {}).finally(() => { settled = true; });
  expect(trace).toEqual(["parent", "child", "called"]);
  child.resolve();
  try {
    await tailStarted.promise;
    await turn();
    expect(settled).toBe(false);
    expect(() => worker.extract()).toThrow("WORKER_BUSY");
  } finally { tail.resolve(); }
  await running;
  expect(trace).toEqual(["parent", "child", "called", "child:done", "tail", "done"]);
});
