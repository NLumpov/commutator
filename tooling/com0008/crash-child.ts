const equal = (actual: unknown, expected: unknown): void => {
  if (actual !== expected) throw new Error(`Mismatch: ${String(actual)} !== ${String(expected)}`);
};
const deepEqual = (actual: unknown, expected: unknown): void =>
  equal(JSON.stringify(actual), JSON.stringify(expected));

import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";

const [repo = "", dir = "", mode = "", crashAt = "none"] = process.argv.slice(2);
const { Commutator, CommonDataType: T } = await import(`${repo}/packages/core/index.ts`);
await mkdir(dir, { recursive: true });
const atomic = async (name: string, value: unknown) => {
  await writeFile(`${dir}/${name}.tmp`, JSON.stringify(value));
  await rename(`${dir}/${name}.tmp`, `${dir}/${name}`);
};
const read = async (name: string) => JSON.parse(await readFile(`${dir}/${name}`, "utf8"));
const trace = async (value: string) => appendFile(`${dir}/trace.log`, `${value}\n`);
const barrier = async (stage: string) => {
  if (crashAt !== stage) return;
  console.log(`READY ${stage}`);
  await new Promise<void>(() => {
    setInterval(() => {}, 1000);
  });
};
const operationId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const agentId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
const agents = {
  async start(title: string) {
    await barrier("before-start");
    let receipt: { operationId: string; title: string; agentId: string };
    if (existsSync(`${dir}/agent.json`)) {
      receipt = await read("agent.json");
      equal(receipt.operationId, operationId);
      equal(receipt.title, title);
    } else {
      receipt = { operationId, title, agentId };
      await atomic("agent.json", receipt);
      await appendFile(`${dir}/effects.log`, `${agentId}\n`);
    }
    await barrier("after-start");
    return receipt.agentId;
  },
};
const commutator = Commutator.initialize()
  .configure({ maxSteps: 10 })
  .defineEvent("Seed", { pinsOut: {}, execPinsOut: { next: null } })
  .defineEvent("Tick", { pinsOut: { title: { type: T.String } }, execPinsOut: { next: null } })
  .defineFunction("SeedOnce", {
    pinsIn: {},
    pinsOut: {},
    execPinsIn: { start: null },
    execPinsOut: {},
    meta: { type: T.Number },
    exec: async ({ exec }: any) => {
      await trace("seed");
      await exec({ pinsOut: {}, meta: 1, execPinOut: null });
    },
  })
  .defineFunction("A", {
    pinsIn: { incoming: { type: T.String } },
    pinsOut: { title: { type: T.String } },
    execPinsIn: { start: null },
    execPinsOut: { child: null },
    meta: { type: T.Number },
    exec: async ({ pinsIn, meta, exec }: any) => {
      await trace("A");
      await exec({ pinsOut: { title: pinsIn.incoming }, meta, execPinOut: "child" });
      await barrier("after-B");
      await trace("tail-A");
      await exec({ pinsOut: { title: pinsIn.incoming }, meta: meta + 1, execPinOut: null });
    },
  })
  .defineFunction("B", {
    pinsIn: { title: { type: T.String } },
    pinsOut: { agentId: { type: T.String } },
    execPinsIn: { start: null },
    execPinsOut: {},
    exec: async ({ pinsIn, exec }: any) => {
      await trace("B");
      const id = await agents.start(pinsIn.title);
      await exec({ pinsOut: { agentId: id }, meta: null, execPinOut: null });
    },
  });
if (mode === "prepare") {
  const schema = commutator.createSchema();
  const a = schema.createFunction("A"),
    b = schema.createFunction("B"),
    seed = schema.createFunction("SeedOnce");
  schema.createEvent("Seed").wire("next", seed, "start");
  schema.createEvent("Tick").wire("next", a, "start").wire("title", a, "incoming");
  a.wire("child", b, "start").wire("title", b, "title");
  const worker = schema.createWorker();
  await worker.triggerEvent("Seed", {});
  await atomic("graph.json", schema.extract());
  await atomic("nodes.json", { a: a.uuid, b: b.uuid, seed: seed.uuid });
  await atomic("baseline.json", worker.extract());
  await atomic("command.json", {
    status: "pending",
    operationId,
    input: { title: "same recorded input" },
  });
  console.log("PREPARED");
} else {
  const command = await read("command.json");
  if (command.status === "done") {
    equal(command.operationId, operationId);
    const worker = commutator.createSchema(await read("graph.json")).createWorker(command.snapshot);
    deepEqual(worker.extract(), command.snapshot);
    console.log("RECONCILED");
  } else {
    const baseline = await read("baseline.json");
    const before = JSON.stringify(baseline);
    const worker = commutator.createSchema(await read("graph.json")).createWorker(baseline);
    await worker.triggerEvent("Tick", command.input);
    equal(JSON.stringify(baseline), before);
    await barrier("before-commit");
    const snapshot = worker.extract();
    await atomic("command.json", { ...command, status: "done", snapshot });
    await barrier("after-commit");
    console.log("COMMITTED");
  }
}
