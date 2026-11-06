// biome-ignore-all lint/suspicious/noMisplacedAssertion: This standalone child probe asserts before process exit, outside the parent test runner.
import assert from "node:assert/strict";
import { CommonDataType, Commutator } from "../../commutator";

const mode = process.argv[2];
const maxSteps = mode === "interrupt" ? 1_000_000 : 20_000;
let entered = 0;
let settled = 0;
let target = Number.POSITIVE_INFINITY;
let expectedTail = 0;
let pause!: () => void;
let release!: () => void;
let gate: Promise<void>;
const commutator = Commutator.initialize()
  .configure({ maxSteps })
  .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
  .defineFunction("Loop", {
    pinsIn: {},
    pinsOut: { value: { type: CommonDataType.Number } },
    execPinsIn: { enter: null },
    execPinsOut: { next: null },
    meta: { type: CommonDataType.Number },
    exec: async ({ exec, meta }) => {
      const local = ++entered;
      try {
        if (local === target) {
          pause();
          await gate;
        }
        await exec({
          execPinOut: local === target ? null : "next",
          pinsOut: { value: local },
          meta: (meta ?? 0) + 1,
        });
        assert.equal(local, expectedTail--, "await exec tails must unwind in reverse order");
      } finally {
        settled++;
      }
    },
  });
const schema = commutator.createSchema();
const loop = schema.createFunction("Loop");
schema.createEvent("start").wire("next", loop, "enter");
loop.wire("next", loop, "enter");
const worker = commutator.createSchema(schema.extract()).createWorker();

if (mode === "interrupt") {
  const running = worker.triggerEvent("start", {});
  setTimeout(() => console.log("interrupt-ready"), 0);
  await running;
  throw new Error("The parent should terminate this bounded child after readiness");
}

const samples = [];
for (const length of [1000, maxSteps, maxSteps, maxSteps]) {
  entered = 0;
  settled = 0;
  target = length;
  expectedTail = length;
  const paused = new Promise<void>((resolve) => {
    pause = resolve;
  });
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  Bun.gc(true);
  const before = process.memoryUsage();
  const running = worker.triggerEvent("start", {});
  try {
    await paused;
    assert.equal(entered, length);
    assert.equal(settled, 0);
    Bun.gc(true);
    const suspended = process.memoryUsage();
    release();
    await running;
    assert.equal(settled, length);
    assert.equal(expectedTail, 0);
    Bun.gc(true);
    const after = process.memoryUsage();
    if (length === maxSteps) {
      // This is a retention check after explicit collection, not a speed/RSS budget.
      assert.ok(
        after.heapUsed < suspended.heapUsed / 2,
        "suspended continuations must be released",
      );
    }
    const snapshot = worker.extract();
    assert.equal(snapshot.pinCache.length, 1);
    assert.equal(snapshot.metaCache.length, 1);
    samples.push({ length, entered, settled, before, suspended, after });
  } finally {
    release();
    await running;
  }
}

entered = 0;
settled = 0;
target = Number.POSITIVE_INFINITY;
await assert.rejects(worker.triggerEvent("start", {}), { code: "STEP_LIMIT" });
assert.equal(entered, maxSteps);
assert.equal(settled, maxSteps);
console.log(JSON.stringify({ status: "PASS", samples, limited: { entered, settled } }));
