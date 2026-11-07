import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator } from "@commutator/core";
import { flowControlExtension } from "../index";

function createFlipFlopGraph() {
  const hits: (string | null)[] = [];
  const commutator = Commutator.initialize()
    .inject(flowControlExtension)
    .defineEvent("Tick", {
      pinsOut: {},
      execPinsOut: { next: null },
    })
    .defineFunction("Capture", {
      pinsIn: {},
      pinsOut: {},
      execPinsIn: { start: null },
      execPinsOut: {},
      config: { type: CommonDataType.String },
      exec: async ({ config }) => {
        hits.push(config);
      },
    });

  const schema = commutator.createSchema();
  const tick = schema.createEvent("Tick");
  const flipFlop = schema.createFunction("FlipFlop");
  const flip = schema.createFunction("Capture", "Flip");
  const flop = schema.createFunction("Capture", "Flop");

  tick.wire("next", flipFlop, "");
  flipFlop.wire("Flip", flip, "start");
  flipFlop.wire("Flop", flop, "start");

  return { commutator, schema, flipFlop, hits };
}

describe("FlipFlop", () => {
  test("starts with Flip and alternates once per sequential input", async () => {
    const { schema, flipFlop, hits } = createFlipFlopGraph();
    const worker = schema.createWorker();

    expect(worker.extract().metaCache).toEqual([]);
    await worker.triggerEvent("Tick", {});
    expect(hits).toEqual(["Flip"]);

    await worker.triggerEvent("Tick", {});
    await worker.triggerEvent("Tick", {});
    await worker.triggerEvent("Tick", {});

    expect(hits).toEqual(["Flip", "Flop", "Flip", "Flop"]);
    expect(worker.extract().metaCache).toEqual([{ uuid: flipFlop.instance.uuid, cache: false }]);
  });

  test("restoring true after Flip preserves Flop as the next branch", async () => {
    const { commutator, schema, flipFlop, hits } = createFlipFlopGraph();
    const worker = schema.createWorker();

    await worker.triggerEvent("Tick", {});
    const snapshot = worker.extract();
    expect(snapshot.metaCache).toEqual([{ uuid: flipFlop.instance.uuid, cache: true }]);

    const restoredSchema = commutator.createSchema(schema.extract());
    const restored = restoredSchema.createWorker(snapshot);
    expect(restored.extract()).toEqual(snapshot);
    await restored.triggerEvent("Tick", {});
    await restored.triggerEvent("Tick", {});

    expect(hits).toEqual(["Flip", "Flop", "Flip"]);
  });

  test("restoring false after Flop preserves Flip as the next branch", async () => {
    const { commutator, schema, flipFlop, hits } = createFlipFlopGraph();
    const worker = schema.createWorker();

    await worker.triggerEvent("Tick", {});
    await worker.triggerEvent("Tick", {});
    const snapshot = worker.extract();
    expect(snapshot.metaCache).toEqual([{ uuid: flipFlop.instance.uuid, cache: false }]);

    const restoredSchema = commutator.createSchema(schema.extract());
    const restored = restoredSchema.createWorker(snapshot);
    expect(restored.extract()).toEqual(snapshot);
    await restored.triggerEvent("Tick", {});
    await restored.triggerEvent("Tick", {});

    expect(hits).toEqual(["Flip", "Flop", "Flip", "Flop"]);
  });
});
