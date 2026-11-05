import { describe, expect, test } from "bun:test";
import { Commutator, PinInstanceType } from "@commutator/core";
import { flowControlExtension } from "../index";

function createGateGraph(onTail: () => Promise<void> = async () => {}) {
  const hits: string[] = [];
  const trace: string[] = [];
  const commutator = Commutator.initialize()
    .inject(flowControlExtension)
    .defineEvent("Tick", { pinsOut: {}, execPinsOut: { next: null } })
    .defineEvent("Open", { pinsOut: {}, execPinsOut: { next: null } })
    .defineEvent("Close", { pinsOut: {}, execPinsOut: { next: null } })
    .defineEvent("Toggle", { pinsOut: {}, execPinsOut: { next: null } })
    .defineFunction("Capture", {
      pinsIn: {},
      pinsOut: {},
      execPinsIn: { start: null },
      execPinsOut: { next: null },
      exec: async ({ exec }) => {
        hits.push("capture");
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
  const tick = schema.createEvent("Tick");
  const gate = schema.createFunction("Gate");
  const capture = schema.createFunction("Capture");
  const tail = schema.createFunction("Tail");

  function gatePin(type: PinInstanceType) {
    const pin = schema.getNodePins(gate.uuid).find((p) => p.name === "" && p.type === type);
    if (!pin) throw new Error(`Missing ${type} pin on Gate`);
    return pin;
  }

  schema.wire({
    fromPinUuid: schema.getPin(tick.uuid, "next").uuid,
    toPinUuid: gatePin(PinInstanceType.InputExec).uuid,
  });
  schema.wire({
    fromPinUuid: gatePin(PinInstanceType.OutputExec).uuid,
    toPinUuid: schema.getPin(capture.uuid, "start").uuid,
  });
  schema.createEvent("Open").wire("next", gate, "Open");
  schema.createEvent("Close").wire("next", gate, "Close");
  schema.createEvent("Toggle").wire("next", gate, "Toggle");
  capture.wire("next", tail, "start");

  return { commutator, schema, gate, hits, trace };
}

describe("Gate", () => {
  test("an open Gate forwards each sequential tick exactly once", async () => {
    const { schema, hits } = createGateGraph();
    const worker = schema.createWorker();

    await worker.triggerEvent("Open", {});
    expect(hits).toEqual([]);

    await worker.triggerEvent("Tick", {});
    expect(hits).toEqual(["capture"]);

    await worker.triggerEvent("Tick", {});
    expect(hits).toEqual(["capture", "capture"]);
  });

  test("Open, Close and Toggle update state without executing downstream", async () => {
    const { schema, gate, hits } = createGateGraph();
    const worker = schema.createWorker();

    const transitions: ["Open" | "Close" | "Toggle", boolean][] = [
      ["Open", true],
      ["Close", false],
      ["Toggle", true],
      ["Toggle", false],
      ["Open", true],
    ];

    for (const [event, expected] of transitions) {
      await worker.triggerEvent(event, {});
      expect(worker.extract().metaCache).toEqual([{ uuid: gate.uuid, cache: expected }]);
      expect(hits).toEqual([]);
    }
  });

  test("restoring an open Gate forwards the next tick", async () => {
    const { commutator, schema, gate, hits } = createGateGraph();
    const worker = schema.createWorker();

    await worker.triggerEvent("Open", {});
    const snapshot = worker.extract();
    expect(snapshot.metaCache).toEqual([{ uuid: gate.uuid, cache: true }]);

    const restoredSchema = commutator.createSchema(schema.extract());
    const restored = restoredSchema.createWorker(snapshot);
    expect(restored.extract()).toEqual(snapshot);
    await restored.triggerEvent("Tick", {});

    expect(hits).toEqual(["capture"]);
  });

  test("awaited tick waits for the nested asynchronous child chain", async () => {
    const enteredTail = Promise.withResolvers<void>();
    const releaseTail = Promise.withResolvers<void>();
    const { schema, trace } = createGateGraph(async () => {
      enteredTail.resolve();
      await releaseTail.promise;
    });
    const worker = schema.createWorker();
    await worker.triggerEvent("Open", {});
    const trigger = worker.triggerEvent("Tick", {}).then(() => {
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
