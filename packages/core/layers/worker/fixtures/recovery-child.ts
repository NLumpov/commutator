import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CommonDataType, Commutator } from "../../commutator";

const [directory, mode] = process.argv.slice(2);
if (!directory || !mode) throw new Error("directory and mode required");
const trace = (step: string) => appendFileSync(join(directory, "trace"), `${step}\n`);
async function pause(point: string) {
  if (mode !== point) return;
  console.log("kill-ready");
  await new Promise<void>(() => setInterval(() => {}, 1000));
}
const commutator = Commutator.initialize()
  .defineEvent("committed", { pinsOut: {}, execPinsOut: { next: null } })
  .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
  .defineFunction("prior", {
    pinsIn: {},
    pinsOut: {},
    execPinsIn: { in: null },
    execPinsOut: {},
    meta: { type: CommonDataType.Number },
    exec: async ({ exec, meta }) => {
      trace("committed");
      await exec({ pinsOut: {}, execPinOut: null, meta: (meta ?? 0) + 1 });
    },
  })
  .defineFunction("A", {
    pinsIn: {},
    pinsOut: {},
    execPinsIn: { in: null },
    execPinsOut: { next: null },
    meta: { type: CommonDataType.Number },
    exec: async ({ exec, meta }) => {
      trace("A");
      await exec({ pinsOut: {}, execPinOut: "next", meta: (meta ?? 0) + 1 });
      await pause("after");
      trace("tail");
    },
  })
  .defineFunction("B", {
    pinsIn: {},
    pinsOut: {},
    execPinsIn: { in: null },
    execPinsOut: {},
    meta: { type: CommonDataType.Number },
    exec: async ({ exec, meta }) => {
      trace("B");
      await exec({ pinsOut: {}, execPinOut: null, meta: (meta ?? 0) + 1 });
      await pause("inside");
    },
  });
const graphPath = join(directory, "schema.json");
const graph = existsSync(graphPath) ? JSON.parse(readFileSync(graphPath, "utf8")) : undefined;
const schema = commutator.createSchema(graph);
if (!graph) {
  schema.createEvent("committed").wire("next", schema.createFunction("prior"), "in");
  const a = schema.createFunction("A");
  schema.createEvent("start").wire("next", a, "in");
  a.wire("next", schema.createFunction("B"), "in");
  writeFileSync(graphPath, JSON.stringify(schema.extract()));
}
const baselinePath = join(directory, "baseline.json");
if (mode === "init") {
  const worker = schema.createWorker();
  await worker.triggerEvent("committed", {});
  writeFileSync(baselinePath, JSON.stringify(worker.extract()));
} else {
  const worker = schema.createWorker(JSON.parse(readFileSync(baselinePath, "utf8")));
  await worker.triggerEvent("start", {});
  writeFileSync(join(directory, "result.json"), JSON.stringify(worker.extract()));
}
