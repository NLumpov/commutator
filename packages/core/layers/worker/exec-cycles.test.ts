import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator, CommutatorExecutionError, NodeType } from "../commutator";

function loopFixture(maxSteps?: number, stopAt?: number, twoNodes = false) {
  let visits = 0;
  const trace: string[] = [];
  const base = Commutator.initialize();
  const configured = maxSteps === undefined ? base : base.configure({ maxSteps });
  const commutator = configured
    .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("Loop", {
      pinsIn: {},
      pinsOut: { value: { type: CommonDataType.Number } },
      execPinsIn: { enter: null },
      execPinsOut: { next: null },
      meta: { type: CommonDataType.Number },
      exec: async ({ exec, meta }) => {
        const visit = ++visits;
        trace.push(`enter:${visit}`);
        await exec({
          pinsOut: { value: visit },
          meta: (meta ?? 0) + 1,
          execPinOut: visit === stopAt ? null : "next",
        });
        trace.push(`tail:${visit}`);
      },
    });
  const schema = commutator.createSchema();
  const start = schema.createEvent("start");
  const loop = schema.createFunction("Loop");
  start.wire("next", loop, "enter");
  if (twoNodes) {
    const other = schema.createFunction("Loop");
    loop.wire("next", other, "enter");
    other.wire("next", loop, "enter");
  } else {
    loop.wire("next", loop, "enter");
  }
  return { commutator, schema, trace, visits: () => visits };
}

describe("execution budgets", () => {
  test.each([
    0,
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid maxSteps %s at configuration", (maxSteps) => {
    try {
      Commutator.initialize().configure({ maxSteps });
      throw new Error("Expected invalid configuration to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CommutatorExecutionError);
      expect(error).toHaveProperty("code", "INVALID_MAX_STEPS");
    }
  });

  test("rejects a missing configure budget from an untyped caller", () => {
    const commutator = Commutator.initialize();
    expect(() => Reflect.apply(commutator.configure, commutator, [{}])).toThrow(
      "INVALID_MAX_STEPS",
    );
  });

  test("accepts the largest safe integer as a budget", async () => {
    const fixture = loopFixture(Number.MAX_SAFE_INTEGER, 1);
    await fixture.schema.createWorker().triggerEvent("start", {});
    expect(fixture.visits()).toBe(1);
  });

  test("requires a budget for cycles before mutating event or Function caches", async () => {
    const fixture = loopFixture();
    const worker = fixture.schema.createWorker();
    const before = worker.extract();
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty(
      "code",
      "MAX_STEPS_REQUIRED",
    );
    expect(worker.extract()).toEqual(before);
    expect(fixture.visits()).toBe(0);
  });

  test("cannot introduce an unlimited cycle by editing a running schema", async () => {
    let visits = 0;
    let connect = () => {};
    const commutator = Commutator.initialize()
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Loop", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: { next: null },
        exec: ({ exec }) => {
          visits++;
          connect();
          return exec({ execPinOut: "next", pinsOut: {}, meta: null });
        },
      });
    const schema = commutator.createSchema();
    const loop = schema.createFunction("Loop");
    schema.createEvent("start").wire("next", loop, "enter");
    connect = () => {
      loop.wire("next", loop, "enter");
    };
    await expect(schema.createWorker().triggerEvent("start", {})).rejects.toHaveProperty(
      "code",
      "MAX_STEPS_REQUIRED",
    );
    expect(visits).toBe(1);
  });

  test("wire/extract/restore preserves a real cycle and conditional exit", async () => {
    const fixture = loopFixture(3, 3, true);
    const graph = fixture.schema.extract();
    const restored = fixture.commutator.createSchema(graph);
    expect(restored.extract()).toEqual(graph);
    const worker = restored.createWorker();
    await worker.triggerEvent("start", {});
    expect(fixture.trace).toEqual(["enter:1", "enter:2", "enter:3", "tail:3", "tail:2", "tail:1"]);
    expect(worker.extract().pinCache.map((entry) => entry.cache)).toEqual([3, 2]);
    expect(worker.extract().metaCache.map((entry) => entry.cache)).toEqual([2, 1]);
  });

  test("unwire removes an exec back edge from traversal, snapshots, and cycle detection", async () => {
    // The callback also has a finite exit so a stale traversal edge cannot hang this test.
    const fixture = loopFixture(undefined, 3);
    const graph = fixture.schema.extract();
    const last = graph.wires.at(-1);
    expect(last).toBeDefined();
    if (!last) throw new Error("Expected an exec back edge");
    fixture.schema.unwire({ fromPinUuid: last.from, toPinUuid: last.to });
    expect(fixture.schema.extract().wires).toHaveLength(1);
    const worker = fixture.schema.createWorker();
    await worker.triggerEvent("start", {});
    expect(fixture.visits()).toBe(1);
    // Removing twice is still safe; reconnecting must restore cycle detection.
    fixture.schema.unwire({ fromPinUuid: last.from, toPinUuid: last.to });
    fixture.schema.wire({ fromPinUuid: last.from, toPinUuid: last.to });
    expect(fixture.schema.extract().wires).toHaveLength(2);
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty(
      "code",
      "MAX_STEPS_REQUIRED",
    );
  });

  test("admits exactly N visits, preserves outputs, and resets only for a new trigger", async () => {
    const fixture = loopFixture(3);
    const worker = fixture.schema.createWorker();
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "STEP_LIMIT");
    expect(fixture.visits()).toBe(3);
    expect(worker.extract().pinCache.map((entry) => entry.cache)).toEqual([3]);
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "STEP_LIMIT");
    expect(fixture.visits()).toBe(6);
    const restored = fixture.schema.createWorker(worker.extract());
    await expect(restored.triggerEvent("start", {})).rejects.toHaveProperty("code", "STEP_LIMIT");
    expect(fixture.visits()).toBe(9);
    expect(restored.extract().metaCache.map((entry) => entry.cache)).toEqual([9]);
    expect(Object.keys(restored.extract()).sort()).toEqual(["metaCache", "pinCache"]);
  });

  test("inherits the receiving instance's limit through every fluent operation and inject", async () => {
    let visits = 0;
    const options = { maxSteps: 2 };
    const base = Commutator.initialize().configure(options);
    options.maxSteps = 100;
    const commutator = base
      .defineDataType("Text", { type: CommonDataType.String })
      .defineApi("api", { read: () => "value" })
      .defineRef("Ref", { pinsOut: {}, resolveRef: async () => ({}) })
      .definePureFunction("Pure", { pinsIn: {}, pinsOut: {}, exec: async () => ({}) })
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Loop", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: { next: null },
        exec: ({ exec }) => {
          visits++;
          return exec({ execPinOut: "next", pinsOut: {}, meta: null });
        },
      })
      .inject(Commutator.initialize().configure({ maxSteps: 1000 }));
    const schema = commutator.createSchema();
    const loop = schema.createFunction("Loop");
    schema.createEvent("start").wire("next", loop, "enter");
    loop.wire("next", loop, "enter");
    await expect(schema.createWorker().triggerEvent("start", {})).rejects.toHaveProperty(
      "code",
      "STEP_LIMIT",
    );
    expect(visits).toBe(2);
    const withoutBudget = Commutator.initialize().inject(commutator).createSchema(schema.extract());
    await expect(withoutBudget.createWorker().triggerEvent("start", {})).rejects.toHaveProperty(
      "code",
      "MAX_STEPS_REQUIRED",
    );
  });

  test("preserves positional initialization and inferred types through configure", async () => {
    let value: unknown;
    const original = Commutator.initialize(
      { Text: { type: CommonDataType.String } },
      {
        start: {
          type: NodeType.Event,
          pinsIn: {},
          execPinsIn: {},
          pinsOut: { value: { type: "Text" } },
          execPinsOut: { next: null },
        },
      },
      {},
      {},
      {},
      { example: { value: "positional" } },
    );
    const configured: typeof original = original.configure({ maxSteps: 1 });
    const commutator = configured.defineFunction("Read", {
      pinsIn: { value: { type: "Text" } },
      pinsOut: {},
      execPinsIn: { enter: null },
      execPinsOut: {},
      exec: async ({ pinsIn }) => {
        value = pinsIn.value;
      },
    });
    const schema = commutator.createSchema();
    const read = schema.createFunction("Read");
    schema.createEvent("start").wire("next", read, "enter").wire("value", read, "value");
    await schema.createWorker().triggerEvent("start", { value: "positional" });
    expect(value).toBe("positional");
  });

  test("configure returns a new instance without changing existing schemas or workers", async () => {
    const fixture = loopFixture(3);
    const worker = fixture.schema.createWorker();
    const configured = fixture.commutator.configure({ maxSteps: 1 });
    const other = configured.createSchema(fixture.schema.extract()).createWorker();
    expect(configured).not.toBe(fixture.commutator);
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "STEP_LIMIT");
    expect(fixture.visits()).toBe(3);
    await expect(other.triggerEvent("start", {})).rejects.toHaveProperty("code", "STEP_LIMIT");
    expect(fixture.visits()).toBe(4);
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "STEP_LIMIT");
    expect(fixture.visits()).toBe(7);
  });

  test("counts all parallel branches in one run and latches the same failure", async () => {
    const calls = { left: 0, right: 0 };
    const failures: unknown[] = [];
    const commutator = Commutator.initialize()
      .configure({ maxSteps: 5 })
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Fork", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: { left: null, right: null },
        exec: async ({ exec }) => {
          await Promise.all(
            ["left", "right"].map((execPinOut) =>
              exec({ execPinOut, pinsOut: {}, meta: null }).catch((error) => {
                failures.push(error);
              }),
            ),
          );
          // Catching a child failure must not replenish or clear the run's budget.
          await exec({ execPinOut: "left", pinsOut: {}, meta: null }).catch((error) => {
            failures.push(error);
          });
        },
      })
      .defineFunction("Branch", {
        config: { type: CommonDataType.StringEnum, values: ["left", "right"] },
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: { next: null },
        exec: async ({ config, exec }) => {
          if (config === "left" || config === "right") calls[config]++;
          await Promise.resolve();
          await exec({ execPinOut: "next", pinsOut: {}, meta: null });
        },
      });
    const schema = commutator.createSchema();
    const fork = schema.createFunction("Fork");
    schema.createEvent("start").wire("next", fork, "enter");
    const names: ("left" | "right")[] = ["left", "right"];
    for (const name of names) {
      const branch = schema.createFunction("Branch", name);
      fork.wire(name, branch, "enter");
      branch.wire("next", branch, "enter");
    }
    await expect(schema.createWorker().triggerEvent("start", {})).rejects.toHaveProperty(
      "code",
      "STEP_LIMIT",
    );
    expect(calls.left).toBeGreaterThan(0);
    expect(calls.right).toBeGreaterThan(0);
    expect(calls.left + calls.right).toBe(4);
    expect(failures.length).toBe(3);
    expect(failures.every((error) => error === failures[0])).toBe(true);
  });

  test("concurrent triggers have independent counters, including multiple event instances", async () => {
    let visits = 0;
    const commutator = Commutator.initialize()
      .configure({ maxSteps: 2 })
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Read", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: {},
        exec: async () => {
          visits++;
          await Promise.resolve();
        },
      });
    const schema = commutator.createSchema();
    const read = schema.createFunction("Read");
    schema.createEvent("start").wire("next", read, "enter");
    schema.createEvent("start").wire("next", read, "enter");
    const worker = schema.createWorker();
    await Promise.all([worker.triggerEvent("start", {}), worker.triggerEvent("start", {})]);
    expect(visits).toBe(4);
    schema.createEvent("start").wire("next", read, "enter");
    await expect(worker.triggerEvent("start", {})).rejects.toHaveProperty("code", "STEP_LIMIT");
    expect(visits).toBe(6);
  });

  test("checks admission before pulling external Ref inputs", async () => {
    let reads = 0;
    const commutator = Commutator.initialize()
      .configure({ maxSteps: 1 })
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineRef("External", {
        pinsOut: { value: { type: CommonDataType.Number } },
        resolveRef: async () => {
          reads++;
          return { value: 1 };
        },
      })
      .defineFunction("Pass", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: { next: null },
        exec: ({ exec }) => exec({ execPinOut: "next", pinsOut: {}, meta: null }),
      })
      .defineFunction("Read", {
        pinsIn: { value: { type: CommonDataType.Number } },
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: {},
        exec: async () => {},
      });
    const schema = commutator.createSchema();
    const pass = schema.createFunction("Pass");
    const read = schema.createFunction("Read");
    schema.createEvent("start").wire("next", pass, "enter");
    pass.wire("next", read, "enter");
    schema.createRef("External").wire("value", read, "value");
    await expect(schema.createWorker().triggerEvent("start", {})).rejects.toHaveProperty(
      "code",
      "STEP_LIMIT",
    );
    expect(reads).toBe(0);
  });

  test("waits for admitted sibling work when another branch hits the limit", async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    let siblingFinished = false;
    const commutator = Commutator.initialize()
      .configure({ maxSteps: 2 })
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Fork", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: { left: null, right: null },
        exec: async ({ exec }) => {
          await Promise.all([
            exec({ execPinOut: "left", pinsOut: {}, meta: null }),
            exec({ execPinOut: "right", pinsOut: {}, meta: null }),
          ]);
        },
      })
      .defineFunction("Wait", {
        pinsIn: {},
        pinsOut: { value: { type: CommonDataType.Number } },
        execPinsIn: { enter: null },
        execPinsOut: {},
        exec: async ({ exec }) => {
          await waiting;
          await exec({ execPinOut: null, pinsOut: { value: 42 }, meta: null });
          siblingFinished = true;
        },
      });
    const schema = commutator.createSchema();
    const fork = schema.createFunction("Fork");
    const wait = schema.createFunction("Wait");
    schema.createEvent("start").wire("next", fork, "enter");
    fork.wire("left", wait, "enter").wire("right", wait, "enter");
    const worker = schema.createWorker();
    let settled = false;
    const running = worker.triggerEvent("start", {}).catch((error) => {
      settled = true;
      return error;
    });
    try {
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);
    } finally {
      release();
    }
    expect(await running).toHaveProperty("code", "STEP_LIMIT");
    expect(siblingFinished).toBe(true);
    expect(worker.extract().pinCache.map((entry) => entry.cache)).toEqual([42]);
  });

  test("captures direct inputs before a cyclic yield and preserves await exec tails", async () => {
    let visits = 0;
    let changed = false;
    let firstDelayedInput: unknown;
    let captured = false;
    let remainingTails = 200;
    const commutator = Commutator.initialize()
      .configure({ maxSteps: 201 })
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Write", {
        pinsIn: {},
        pinsOut: { value: { type: CommonDataType.Number } },
        execPinsIn: { enter: null },
        execPinsOut: { next: null },
        exec: async ({ exec }) => {
          const first = exec({ execPinOut: "next", pinsOut: { value: 1 }, meta: null });
          changed = true;
          await exec({ execPinOut: null, pinsOut: { value: 2 }, meta: null });
          await first;
          expect(remainingTails).toBe(0);
        },
      })
      .defineFunction("Loop", {
        pinsIn: { value: { type: CommonDataType.Number } },
        pinsOut: {},
        execPinsIn: { enter: null },
        execPinsOut: { next: null },
        exec: async ({ pinsIn, exec }) => {
          const local = ++visits;
          if (changed && !captured) {
            captured = true;
            firstDelayedInput = pinsIn.value;
          }
          await exec({ execPinOut: local < 200 ? "next" : null, pinsOut: {}, meta: null });
          expect(local).toBe(remainingTails--);
        },
      });
    const schema = commutator.createSchema();
    const write = schema.createFunction("Write");
    const loop = schema.createFunction("Loop");
    schema.createEvent("start").wire("next", write, "enter");
    write.wire("next", loop, "enter").wire("value", loop, "value");
    loop.wire("next", loop, "enter");
    await schema.createWorker().triggerEvent("start", {});
    expect(visits).toBe(200);
    expect(captured).toBe(true);
    expect(firstDelayedInput).toBe(1);
  });
});
