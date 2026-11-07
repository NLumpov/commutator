import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator } from "../../commutator";

/** A test fake of consumer-owned operations and Agents, never production Worker state. */
class FakeOperations {
  readonly operations = new Map<string, { operationId: string; request: string; agentId?: string }>();
  starts = 0;
  unknown = false;
  ensure(key: string, request: string) {
    const existing = this.operations.get(key);
    if (existing) {
      if (existing.request !== request) throw new Error("OPERATION_CONFLICT");
      return existing;
    }
    const operation = { operationId: `01ARZ3NDEKTSV4RRFFQ69G5FA${this.operations.size + 1}`, request, agentId: undefined as string | undefined };
    this.operations.set(key, operation);
    return operation;
  }
  start(key: string, request: string, loseResponse: boolean) {
    const operation = this.ensure(key, request);
    if (this.unknown) throw new Error("OUTCOME_UNKNOWN");
    if (!operation.agentId) operation.agentId = `01ARZ3NDEKTSV4RRFFQ69G5FB${++this.starts}`;
    if (loseResponse) throw new Error("lost response");
    return operation.agentId;
  }
}

for (const crash of ["before-B", "inside-B", "after-B"] as const) {
  test(`whole trigger replay includes child and parent tail after ${crash}`, async () => {
    const operations = new FakeOperations();
    let fail = true;
    const trace: string[] = [];
    let committed = 0;
    const commutator = Commutator.initialize().configure({ maxSteps: 10 })
      .defineEvent("committed", { pinsOut: {}, execPinsOut: { next: null } })
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Committed", { pinsIn: {}, pinsOut: {}, execPinsIn: { enter: null }, execPinsOut: {},
        meta: { type: CommonDataType.Number }, exec: async ({ meta, exec }) => {
          committed++; await exec({ pinsOut: {}, execPinOut: null, meta: (meta ?? 0) + 1 });
        },
      })
      .defineFunction("A", { pinsIn: {}, pinsOut: { done: { type: CommonDataType.Boolean } }, execPinsIn: { enter: null }, execPinsOut: { child: null },
        exec: async ({ exec }) => {
          trace.push("A");
          if (fail && crash === "before-B") throw new Error("before B");
          await exec({ pinsOut: { done: null }, execPinOut: "child", meta: null });
          trace.push("A:tail");
          if (fail && crash === "after-B") throw new Error("after B");
          await exec({ pinsOut: { done: true }, execPinOut: null, meta: null });
        },
      })
      .defineFunction("B", { pinsIn: {}, pinsOut: { agentId: { type: CommonDataType.String } }, execPinsIn: { enter: null }, execPinsOut: {},
        exec: async ({ exec }) => {
          trace.push("B");
          const agentId = operations.start("run/action/iteration-1", "pinned request", fail && crash === "inside-B");
          await exec({ pinsOut: { agentId }, execPinOut: null, meta: null });
        },
      });
    const schema = commutator.createSchema();
    const a = schema.createFunction("A"), b = schema.createFunction("B");
    schema.createEvent("start").wire("next", a, "enter");
    a.wire("child", b, "enter");
    schema.createEvent("committed").wire("next", schema.createFunction("Committed"), "enter");
    const first = schema.createWorker();
    await first.triggerEvent("committed", {});
    const baseline = first.extract();
    const baselineJson = JSON.stringify(baseline);
    const commandInput = {};
    const failed = schema.createWorker(baseline);
    await expect(failed.triggerEvent("start", commandInput)).rejects.toThrow();
    expect(() => failed.extract()).toThrow("WORKER_FAILED");
    expect(JSON.stringify(baseline)).toBe(baselineJson);
    fail = false;
    const replay = commutator.createSchema(JSON.parse(JSON.stringify(schema.extract()))).createWorker(baseline);
    await replay.triggerEvent("start", commandInput);
    expect(trace).toEqual(crash === "before-B" ? ["A", "A", "B", "A:tail"]
      : crash === "inside-B" ? ["A", "B", "A", "B", "A:tail"]
      : ["A", "B", "A:tail", "A", "B", "A:tail"]);
    expect(operations.starts).toBe(1);
    expect(committed).toBe(1);
    expect(replay.extract().pinCache).toContainEqual({ uuid: schema.getPin(b.uuid, "agentId").uuid, cache: "01ARZ3NDEKTSV4RRFFQ69G5FB1" });
    expect(replay.extract().pinCache).toContainEqual({ uuid: schema.getPin(a.uuid, "done").uuid, cache: true });
  });
}

describe("consumer operation fake limits", () => {
  test("same action retries keep identity, new iterations and parallel actions differ", () => {
    const fake = new FakeOperations();
    expect(() => fake.start("run/action/1", "request", true)).toThrow("lost response");
    expect(fake.start("run/action/1", "request", false)).toBe("01ARZ3NDEKTSV4RRFFQ69G5FB1");
    expect(fake.start("run/action/1", "request", false)).toBe("01ARZ3NDEKTSV4RRFFQ69G5FB1");
    expect(fake.start("run/action/2", "request", false)).toBe("01ARZ3NDEKTSV4RRFFQ69G5FB2");
    expect(fake.start("run/other/1", "request", false)).toBe("01ARZ3NDEKTSV4RRFFQ69G5FB3");
    expect(new Set([...fake.operations.values()].map((item) => item.operationId)).size).toBe(3);
    expect(() => fake.start("run/action/1", "changed request", false)).toThrow("OPERATION_CONFLICT");
    expect(fake.starts).toBe(3);
  });

  test("unknown outcome blocks a new dispatch; Worker does not retry it", async () => {
    const fake = new FakeOperations();
    fake.unknown = true;
    let calls = 0;
    const commutator = Commutator.initialize()
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Start", { pinsIn: {}, pinsOut: {}, execPinsIn: { enter: null }, execPinsOut: {},
        exec: async () => { calls++; fake.start("run/action/1", "request", false); },
      });
    const schema = commutator.createSchema();
    schema.createEvent("start").wire("next", schema.createFunction("Start"), "enter");
    const worker = schema.createWorker();
    await expect(worker.triggerEvent("start", {})).rejects.toThrow("OUTCOME_UNKNOWN");
    await expect(worker.triggerEvent("start", {})).rejects.toThrow("WORKER_FAILED");
    expect(calls).toBe(1);
    expect(fake.starts).toBe(0);
    expect(fake.operations.size).toBe(1);
  });
});

/** Minimal test-only command store: persistence/leases are the consumer's responsibility. */
class FakeCommandStore {
  owner = 0;
  claimed = false;
  attempts = 0;
  terminal = false;
  receipt: string | undefined;
  constructor(public baseline: import("../types").WorkerSnapshot, readonly maxAttempts = 2) {}
  claim() {
    if (this.receipt) return undefined;
    if (this.claimed) throw new Error("ALREADY_CLAIMED");
    if (this.terminal || this.attempts >= this.maxAttempts) throw new Error("ATTEMPTS_EXHAUSTED");
    this.attempts++;
    this.claimed = true;
    return ++this.owner;
  }
  commit(owner: number, snapshot: import("../types").WorkerSnapshot, loseAck = false) {
    if (owner !== this.owner || !this.claimed) throw new Error("STALE_OWNER");
    // A single consumer transaction publishes baseline + completion + next work.
    this.baseline = snapshot;
    this.receipt = "command-complete/next-status-event";
    this.claimed = false;
    if (loseAck) throw new Error("lost commit acknowledgement");
  }
}

test("consumer receipt reconciles lost commit acknowledgement without replaying the command", async () => {
  const operations = new FakeOperations();
  let calls = 0;
  const commutator = Commutator.initialize()
    .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("Start", { pinsIn: {}, pinsOut: { agentId: { type: CommonDataType.String } }, execPinsIn: { enter: null }, execPinsOut: {},
      exec: async ({ exec }) => {
        calls++;
        const agentId = operations.start("run/action/1", "pinned", false);
        await exec({ pinsOut: { agentId }, execPinOut: null, meta: null });
      },
    });
  const schema = commutator.createSchema();
  schema.createEvent("start").wire("next", schema.createFunction("Start"), "enter");
  const store = new FakeCommandStore(schema.createWorker().extract());
  const owner = store.claim()!;
  const worker = schema.createWorker(store.baseline);
  await worker.triggerEvent("start", {});
  expect(() => store.commit(owner, worker.extract(), true)).toThrow("lost commit acknowledgement");
  // Read the durable receipt before dispatching another attempt.
  expect(store.receipt).toBe("command-complete/next-status-event");
  expect(store.claim()).toBeUndefined();
  expect(calls).toBe(1);
  expect(operations.starts).toBe(1);
  expect(schema.createWorker(store.baseline).extract()).toEqual(worker.extract());
});

test("consumer ownership admits one contender and fences a stale commit", async () => {
  const schema = Commutator.initialize().createSchema();
  const baseline = schema.createWorker().extract();
  const store = new FakeCommandStore(baseline);
  const first = store.claim()!;
  expect(() => store.claim()).toThrow("ALREADY_CLAIMED");
  // Test fake expires the old lease. No production lease protocol is implemented here.
  store.claimed = false;
  const second = store.claim()!;
  expect(() => store.commit(first, baseline)).toThrow("STALE_OWNER");
  expect(store.receipt).toBeUndefined();
  store.commit(second, baseline);
  expect(store.receipt).toBeDefined();
  expect(store.attempts).toBe(2);
});

test("consumer bounds whole-trigger attempts and treats STEP_LIMIT as terminal", async () => {
  let calls = 0;
  const commutator = Commutator.initialize().configure({ maxSteps: 2 })
    .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("Loop", { pinsIn: {}, pinsOut: {}, execPinsIn: { enter: null }, execPinsOut: { next: null },
      exec: async ({ exec }) => { calls++; await exec({ pinsOut: {}, execPinOut: "next", meta: null }); },
    });
  const schema = commutator.createSchema();
  const loop = schema.createFunction("Loop");
  schema.createEvent("start").wire("next", loop, "enter");
  loop.wire("next", loop, "enter");
  const baseline = schema.createWorker().extract();
  const store = new FakeCommandStore(baseline);
  store.claim();
  const worker = schema.createWorker(store.baseline);
  await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "STEP_LIMIT");
  store.terminal = true;
  store.claimed = false;
  expect(() => store.claim()).toThrow("ATTEMPTS_EXHAUSTED");
  expect(calls).toBe(2);
  expect(store.baseline).toEqual(baseline);
  expect(store.receipt).toBeUndefined();

  const retryStore = new FakeCommandStore(baseline, 2);
  // Attempts are accounted before dispatch, including a process lost before any result.
  retryStore.claim(); retryStore.claimed = false;
  retryStore.claim(); retryStore.claimed = false;
  expect(() => retryStore.claim()).toThrow("ATTEMPTS_EXHAUSTED");
  expect(retryStore.attempts).toBe(2);
});
