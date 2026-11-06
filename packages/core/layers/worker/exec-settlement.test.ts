import { expect, test } from "bun:test";
import { CommonDataType, Commutator } from "../commutator";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function graph(
  body: (emit: (value: number) => Promise<void>) => Promise<void>,
  sink: (value: number | null) => Promise<void>,
) {
  const commutator = Commutator.initialize()
    .configure({ maxSteps: 10 })
    .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("Emit", {
      pinsIn: {},
      pinsOut: { value: { type: CommonDataType.Number } },
      execPinsIn: { enter: null },
      execPinsOut: { next: null },
      exec: ({ exec }) =>
        body((value) => exec({ execPinOut: "next", pinsOut: { value }, meta: null })),
    })
    .defineFunction("Sink", {
      pinsIn: { value: { type: CommonDataType.Number } },
      pinsOut: {},
      execPinsIn: { enter: null },
      execPinsOut: {},
      exec: ({ pinsIn }) => sink(pinsIn.value),
    });
  const schema = commutator.createSchema();
  const emit = schema.createFunction("Emit"),
    sinkNode = schema.createFunction("Sink");
  schema.createEvent("start").wire("next", emit, "enter");
  emit.wire("next", sinkNode, "enter").wire("value", sinkNode, "value");
  return schema.createWorker();
}

function observe(promise: Promise<void>) {
  let settled = false;
  const outcome = promise
    .then(
      () => ({ ok: true, error: undefined }),
      (error: unknown) => ({ ok: false, error }),
    )
    .finally(() => {
      settled = true;
    });
  return { outcome, settled: () => settled };
}

for (const failure of [undefined, new Error("body failure")]) {
  for (const asynchronous of [false, true]) {
    test(`drains issued work after ${asynchronous ? "async" : "sync"} body failure ${String(failure)}`, async () => {
      const gate = deferred();
      let sinkFinished = false;
      const body = (emit: (value: number) => Promise<void>) => {
        void emit(1);
        if (asynchronous) return Promise.reject(failure);
        throw failure;
      };
      const worker = graph(body, async () => {
        await gate.promise;
        sinkFinished = true;
        throw new Error("later child failure");
      });
      const run = observe(worker.triggerEvent("start", {}));
      try {
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(run.settled()).toBe(false);
        expect(sinkFinished).toBe(false);
      } finally {
        gate.resolve();
      }
      expect(await run.outcome).toEqual({ ok: false, error: failure });
      expect(sinkFinished).toBe(true);
    });
  }
}

test("returns the rejecting exec Promise and keeps its first observed failure while draining siblings", async () => {
  const first = deferred(),
    sibling = deferred(),
    caught = deferred();
  const failure = new Error("first child failure");
  let observed: unknown;
  let siblingFinished = false;
  const worker = graph(
    async (emit) => {
      void emit(1);
      try {
        await emit(0);
      } catch (error) {
        observed = error;
        caught.resolve();
        throw new Error("later body failure");
      }
    },
    async (value) => {
      if (value === 0) {
        await first.promise;
        throw failure;
      }
      await sibling.promise;
      siblingFinished = true;
    },
  );
  const run = observe(worker.triggerEvent("start", {}));
  try {
    first.resolve();
    await caught.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(observed).toBe(failure);
    expect(run.settled()).toBe(false);
  } finally {
    first.resolve();
    sibling.resolve();
  }
  expect(await run.outcome).toEqual({ ok: false, error: failure });
  expect(siblingFinished).toBe(true);
});

test("a caught exec rejection remains a failure after that call leaves pending tracking", async () => {
  const failure = new Error("observed child failure");
  let caught: unknown;
  const worker = graph(
    async (emit) => {
      await emit(0).catch((error) => {
        caught = error;
      });
      await Promise.resolve();
    },
    async () => {
      throw failure;
    },
  );
  const run = observe(worker.triggerEvent("start", {}));
  expect(await run.outcome).toEqual({ ok: false, error: failure });
  expect(caught).toBe(failure);
});

test("waits for exec issued during drain after an earlier wave reaches zero", async () => {
  const first = deferred(),
    second = deferred(),
    secondStarted = deferred();
  const trace: number[] = [];
  const worker = graph(
    async (emit) => {
      void emit(0).then(() => {
        void emit(1);
      });
    },
    async (value) => {
      if (value === 0) await first.promise;
      else {
        secondStarted.resolve();
        await second.promise;
      }
      trace.push(value ?? -1);
    },
  );
  const run = observe(worker.triggerEvent("start", {}));
  try {
    first.resolve();
    await secondStarted.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(run.settled()).toBe(false);
    expect(trace).toEqual([0]);
  } finally {
    first.resolve();
    second.resolve();
  }
  expect(await run.outcome).toEqual({ ok: true, error: undefined });
  expect(trace).toEqual([0, 1]);
});
