import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator, PinInstanceType } from "@commutator/core";
import { flowControlExtension } from "../index";

function createDoNGraph(onTail: () => Promise<void> = async () => {}) {
  const counters: (number | null)[] = [];
  const trace: string[] = [];
  const commutator = Commutator.initialize()
    .inject(flowControlExtension)
    .defineEvent("Enter", {
      pinsOut: { n: { type: CommonDataType.Number } },
      execPinsOut: { next: null },
    })
    .defineEvent("Reset", {
      pinsOut: {},
      execPinsOut: { next: null },
    })
    .defineFunction("Capture", {
      pinsIn: { counter: { type: CommonDataType.Number } },
      pinsOut: {},
      execPinsIn: { start: null },
      execPinsOut: { next: null },
      exec: async ({ pinsIn, exec }) => {
        counters.push(pinsIn.counter);
        trace.push("capture");
        await exec({ execPinOut: "next", pinsOut: {}, meta: null });
        trace.push("capture:done");
      },
    })
    .defineFunction("Tail", {
      pinsIn: {},
      pinsOut: {},
      execPinsIn: { start: null },
      execPinsOut: {},
      exec: async () => {
        await onTail();
        trace.push("tail:done");
      },
    });

  const schema = commutator.createSchema();
  const enter = schema.createEvent("Enter");
  const reset = schema.createEvent("Reset");
  const doN = schema.createFunction("DoN");
  const capture = schema.createFunction("Capture");
  const tail = schema.createFunction("Tail");

  function pin(nodeUuid: string, name: string, type: PinInstanceType) {
    const result = schema.getNodePins(nodeUuid).find((p) => p.name === name && p.type === type);
    if (!result) throw new Error(`Missing ${type} pin ${name}`);
    return result;
  }

  enter.wire("n", doN, "n");
  schema.wire({
    fromPinUuid: schema.getPin(enter.instance.uuid, "next").uuid,
    toPinUuid: pin(doN.instance.uuid, "", PinInstanceType.InputExec).uuid,
  });
  reset.wire("next", doN, "Reset");
  schema.wire({
    fromPinUuid: pin(doN.instance.uuid, "", PinInstanceType.OutputExec).uuid,
    toPinUuid: schema.getPin(capture.instance.uuid, "start").uuid,
  });
  doN.wire("Counter", capture, "counter");
  capture.wire("next", tail, "start");

  const counterPin = pin(doN.instance.uuid, "Counter", PinInstanceType.Output);
  const worker = schema.createWorker();

  function state() {
    const snapshot = worker.extract();
    return {
      counter: snapshot.pinCache.find((entry) => entry.uuid === counterPin.uuid)?.cache,
      meta: snapshot.metaCache.find((entry) => entry.uuid === doN.instance.uuid)?.cache,
    };
  }

  return { worker, counters, trace, state };
}

describe("DoN", () => {
  test("passes one execution per input for the first N inputs and exposes Counter as data", async () => {
    const { worker, counters, state } = createDoNGraph();

    await worker.triggerEvent("Enter", { n: 2 });
    expect(counters).toEqual([1]);
    expect(state()).toEqual({ counter: 1, meta: 1 });

    await worker.triggerEvent("Enter", { n: 2 });
    expect(counters).toEqual([1, 2]);
    expect(state()).toEqual({ counter: 2, meta: 2 });

    await worker.triggerEvent("Enter", { n: 2 });
    expect(counters).toEqual([1, 2]);
    expect(state()).toEqual({ counter: 2, meta: 2 });
  });

  test("Reset clears Counter and meta without executing downstream, allowing N more inputs", async () => {
    const { worker, counters, state } = createDoNGraph();

    await worker.triggerEvent("Enter", { n: 2 });
    await worker.triggerEvent("Enter", { n: 2 });
    expect(counters).toEqual([1, 2]);

    await worker.triggerEvent("Reset", {});
    expect(counters).toEqual([1, 2]);
    expect(state()).toEqual({ counter: 0, meta: 0 });

    await worker.triggerEvent("Enter", { n: 2 });
    expect(counters).toEqual([1, 2, 1]);
    await worker.triggerEvent("Enter", { n: 2 });
    await worker.triggerEvent("Enter", { n: 2 });
    expect(counters).toEqual([1, 2, 1, 2]);
    expect(state()).toEqual({ counter: 2, meta: 2 });
  });

  test("does not execute downstream when N is zero, including after Reset", async () => {
    const { worker, counters, state } = createDoNGraph();

    await worker.triggerEvent("Enter", { n: 0 });
    expect(counters).toEqual([]);

    await worker.triggerEvent("Reset", {});
    await worker.triggerEvent("Enter", { n: 0 });
    expect(counters).toEqual([]);
    expect(state()).toEqual({ counter: 0, meta: 0 });
  });

  test("awaited triggerEvent waits for the nested asynchronous child chain", async () => {
    const enteredTail = Promise.withResolvers<void>();
    const releaseTail = Promise.withResolvers<void>();
    const { worker, trace } = createDoNGraph(async () => {
      enteredTail.resolve();
      await releaseTail.promise;
    });
    const trigger = worker.triggerEvent("Enter", { n: 1 }).then(() => {
      trace.push("trigger:done");
    });

    try {
      const first = await Promise.race([
        enteredTail.promise.then(() => "tail"),
        trigger.then(() => "trigger"),
      ]);
      expect(first).toBe("tail");
      expect(trace).toEqual(["capture"]);
    } finally {
      releaseTail.resolve();
      await trigger;
    }

    expect(trace).toEqual(["capture", "tail:done", "capture:done", "trigger:done"]);
  });
});
