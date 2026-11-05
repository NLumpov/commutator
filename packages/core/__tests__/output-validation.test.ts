import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator, CommutatorError, type Field } from "../index";

const numberOutputs = {
  first: { type: CommonDataType.Number },
  value: { type: CommonDataType.Number },
} satisfies Record<string, Field<{}>>;

function createFunctionGraph(mode: "await" | "return" | "unawaited" = "await") {
  // Dynamic/plugin output deliberately bypasses static types at the runtime boundary.
  let output: any = { first: 1, value: 7 };
  let nextMeta = 1;
  const seen: unknown[] = [];
  const trace: string[] = [];
  const commutator = Commutator.initialize()
    .defineEvent("Tick", { pinsOut: {}, execPinsOut: { next: null } })
    .defineEvent("Read", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("Source", {
      pinsIn: {},
      pinsOut: numberOutputs,
      execPinsIn: { start: null },
      execPinsOut: { next: null },
      meta: { type: CommonDataType.Number },
      exec: async ({ exec }) => {
        trace.push("source");
        const pending = exec({ pinsOut: output, execPinOut: "next", meta: nextMeta });
        trace.push("source:called");
        if (mode === "return") return pending;
        if (mode === "unawaited") {
          // Leave a turn for an unhandled rejection before the worker's final join.
          await new Promise((resolve) => setTimeout(resolve, 0));
          return;
        }
        await pending;
        trace.push("source:tail");
      },
    })
    .defineFunction("Sink", {
      pinsIn: numberOutputs,
      pinsOut: {},
      execPinsIn: { start: null },
      execPinsOut: {},
      exec: async ({ pinsIn }) => {
        seen.push({ ...pinsIn });
        trace.push("sink");
      },
    });
  const schema = commutator.createSchema();
  const source = schema.createFunction("Source");
  const sink = schema.createFunction("Sink");
  schema.createEvent("Tick").wire("next", source, "start");
  schema.createEvent("Read").wire("next", sink, "start");
  source.wire("next", sink, "start").wire("first", sink, "first").wire("value", sink, "value");
  return {
    commutator,
    schema,
    source,
    seen,
    trace,
    setOutput(value: any, meta = 2) {
      output = value;
      nextMeta = meta;
    },
  };
}

describe("Worker output validation", () => {
  for (const mode of ["await", "return", "unawaited"] as const) {
    test(`${mode} exec rejects invalid output instead of stale cache`, async () => {
      const { schema, seen, trace, setOutput } = createFunctionGraph(mode);
      const worker = schema.createWorker();
      await worker.triggerEvent("Tick", {});
      expect(seen).toEqual([{ first: 1, value: 7 }]);
      const before = worker.extract();

      setOutput({ first: 2, value: "invalid" });
      await expect(worker.triggerEvent("Tick", {})).rejects.toThrow(
        'Invalid value for output pin "value" of node "Source"',
      );
      expect(seen).toEqual([{ first: 1, value: 7 }]);
      expect(worker.extract()).toEqual(before);
      expect(trace).toEqual(
        mode === "await"
          ? ["source", "sink", "source:called", "source:tail", "source", "source:called"]
          : ["source", "sink", "source:called", "source", "source:called"],
      );
    });

    test(`${mode} exec rejects the first invalid output without delivering null`, async () => {
      const { schema, seen, setOutput } = createFunctionGraph(mode);
      setOutput({ first: 2, value: "invalid" });
      const worker = schema.createWorker();
      await expect(worker.triggerEvent("Tick", {})).rejects.toBeInstanceOf(CommutatorError);
      expect(worker.extract()).toEqual({ pinCache: [], metaCache: [] });
      expect(seen).toEqual([]);
    });
  }

  test("valid partial, empty and null outputs preserve the shared pin cache and snapshot", async () => {
    const { commutator, schema, source, seen, trace, setOutput } = createFunctionGraph();
    const worker = schema.createWorker();
    await worker.triggerEvent("Tick", {});
    // Unspecified/undefined outputs retain their previous values; extra keys are ignored.
    setOutput({ first: undefined, value: 8, extra: "ignored" });
    await worker.triggerEvent("Tick", {});
    setOutput({});
    await worker.triggerEvent("Tick", {});
    setOutput({ value: null });
    await worker.triggerEvent("Tick", {});
    await worker.triggerEvent("Read", {});
    expect(seen).toEqual([
      { first: 1, value: 7 },
      { first: 1, value: 8 },
      { first: 1, value: 8 },
      { first: 1, value: null },
      { first: 1, value: null },
    ]);
    expect(trace.slice(0, 4)).toEqual(["source", "sink", "source:called", "source:tail"]);
    const snapshot = worker.extract();
    expect(snapshot.pinCache).toEqual([
      { uuid: schema.getPin(source.uuid, "first").uuid, cache: 1 },
      { uuid: schema.getPin(source.uuid, "value").uuid, cache: null },
    ]);
    expect(snapshot.metaCache).toEqual([{ uuid: source.uuid, cache: 2 }]);
    const restored = commutator.createSchema(schema.extract()).createWorker(snapshot);
    expect(restored.extract()).toEqual(snapshot);
    await restored.triggerEvent("Read", {});
    expect(seen.at(-1)).toEqual({ first: 1, value: null });
  });

  test("a rejected second exec preserves the first exec's published values and effects", async () => {
    const seen: unknown[] = [];
    const commutator = Commutator.initialize()
      .defineEvent("Tick", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Source", {
        pinsIn: {},
        pinsOut: numberOutputs,
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        meta: { type: CommonDataType.Number },
        exec: async ({ exec }) => {
          await exec({ pinsOut: { first: 1, value: 7 }, execPinOut: "next", meta: 1 });
          const invalid: any = { first: 2, value: "invalid" };
          await exec({ pinsOut: invalid, execPinOut: "next", meta: 2 });
        },
      })
      .defineFunction("Sink", {
        pinsIn: numberOutputs,
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: {},
        exec: async ({ pinsIn }) => {
          seen.push({ ...pinsIn });
        },
      });
    const schema = commutator.createSchema();
    const source = schema.createFunction("Source");
    const sink = schema.createFunction("Sink");
    schema.createEvent("Tick").wire("next", source, "start");
    source.wire("next", sink, "start").wire("first", sink, "first").wire("value", sink, "value");
    const worker = schema.createWorker();
    await expect(worker.triggerEvent("Tick", {})).rejects.toThrow(CommutatorError);
    expect(seen).toEqual([{ first: 1, value: 7 }]);
    expect(worker.extract()).toEqual({
      pinCache: [
        { uuid: schema.getPin(source.uuid, "first").uuid, cache: 1 },
        { uuid: schema.getPin(source.uuid, "value").uuid, cache: 7 },
      ],
      metaCache: [{ uuid: source.uuid, cache: 1 }],
    });
  });

  test("an invalid Event batch preserves all prior payload pins and stops its consumers", async () => {
    const seen: unknown[] = [];
    const commutator = Commutator.initialize()
      .defineEvent("Tick", { pinsOut: numberOutputs, execPinsOut: { next: null } })
      .defineFunction("Sink", {
        pinsIn: numberOutputs,
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: {},
        exec: async ({ pinsIn }) => {
          seen.push({ ...pinsIn });
        },
      });
    const schema = commutator.createSchema();
    const sink = schema.createFunction("Sink");
    schema
      .createEvent("Tick")
      .wire("next", sink, "start")
      .wire("first", sink, "first")
      .wire("value", sink, "value");
    const worker = schema.createWorker();
    await worker.triggerEvent("Tick", { first: 1, value: 7 });
    const before = worker.extract();
    await expect(worker.triggerEvent("Tick", { first: 2, value: "invalid" })).rejects.toThrow(
      CommutatorError,
    );
    expect(worker.extract()).toEqual(before);
    expect(seen).toEqual([{ first: 1, value: 7 }]);
    await worker.triggerEvent("Tick", { value: null });
    await worker.triggerEvent("Tick", {});
    expect(seen.slice(1)).toEqual([
      { first: 1, value: null },
      { first: 1, value: null },
    ]);
  });

  test("invalid PureFunction output rejects before the consuming Function runs", async () => {
    let output: any = { first: 1, value: 7 };
    let calls = 0;
    const seen: unknown[] = [];
    const commutator = Commutator.initialize()
      .defineEvent("Tick", { pinsOut: {}, execPinsOut: { next: null } })
      .definePureFunction("Source", {
        pinsIn: {},
        pinsOut: numberOutputs,
        exec: async () => {
          calls++;
          return output;
        },
      })
      .defineFunction("Sink", {
        pinsIn: numberOutputs,
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: {},
        exec: async ({ pinsIn }) => {
          seen.push({ ...pinsIn });
        },
      });
    const schema = commutator.createSchema();
    const sink = schema.createFunction("Sink");
    schema.createEvent("Tick").wire("next", sink, "start");
    schema.createPureFunction("Source").wire("first", sink, "first").wire("value", sink, "value");
    const worker = schema.createWorker();
    await worker.triggerEvent("Tick", {});
    expect(calls).toBe(1);
    output = { first: 2, value: "invalid" };
    await expect(worker.triggerEvent("Tick", {})).rejects.toThrow(CommutatorError);
    expect(seen).toEqual([{ first: 1, value: 7 }]);
    output = { first: null };
    await worker.triggerEvent("Tick", {});
    expect(seen.at(-1)).toEqual({ first: null, value: null });
    output = {};
    await worker.triggerEvent("Tick", {});
    expect(seen.at(-1)).toEqual({ first: null, value: null });
    expect(worker.extract()).toEqual({ pinCache: [], metaCache: [] });
  });

  test("Refs retain valid values, null and missing-value behavior", async () => {
    let output: any = { first: 1, value: 7 };
    let calls = 0;
    const seen: unknown[] = [];
    const commutator = Commutator.initialize()
      .defineEvent("Tick", { pinsOut: {}, execPinsOut: { next: null } })
      .defineRef("Source", {
        pinsOut: numberOutputs,
        resolveRef: async () => {
          calls++;
          return output;
        },
      })
      .defineFunction("Sink", {
        pinsIn: numberOutputs,
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: {},
        exec: async ({ pinsIn }) => {
          seen.push({ ...pinsIn });
        },
      });
    const schema = commutator.createSchema();
    const sink = schema.createFunction("Sink");
    schema.createEvent("Tick").wire("next", sink, "start");
    schema.createRef("Source").wire("first", sink, "first").wire("value", sink, "value");
    const worker = schema.createWorker();
    for (const value of [{ first: 1, value: 7 }, null, { first: 2 }, {}]) {
      output = value;
      await worker.triggerEvent("Tick", {});
    }
    expect(calls).toBe(4);
    expect(seen).toEqual([
      { first: 1, value: 7 },
      { first: null, value: null },
      { first: 2, value: null },
      { first: null, value: null },
    ]);
    expect(worker.extract()).toEqual({ pinCache: [], metaCache: [] });
  });
});
