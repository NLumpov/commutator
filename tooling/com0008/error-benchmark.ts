import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const [repo = "", countText = "5000", output = ""] = process.argv.slice(2);
const count = Number(countText);
if (!repo || !Number.isSafeInteger(count) || count <= 0)
  throw new Error("Usage: error-benchmark.ts repo [count] [output]");
const { Commutator, CommonDataType: T } = await import(`${repo}/packages/core/index.ts`);
let callback: () => Promise<void> = async () => {};
const commutator = Commutator.initialize()
  .defineEvent("start", {
    pinsOut: { value: { type: T.Number } },
    execPinsOut: { next: null },
  })
  .defineFunction("Read", {
    pinsIn: {},
    pinsOut: {},
    execPinsIn: { enter: null },
    execPinsOut: {},
    exec: () => callback(),
  });
const schema = commutator.createSchema();
schema.createEvent("start").wire("next", schema.createFunction("Read"), "enter");
const baseline = schema.createWorker().extract();
const codeOf = (error: unknown) =>
  error !== null && typeof error === "object" && "code" in error ? error.code : undefined;
const rejected = async (promise: Promise<void>, code: string): Promise<void> => {
  try {
    await promise;
  } catch (error) {
    if (codeOf(error) === code) return;
    throw error;
  }
  throw new Error(`Expected ${code}`);
};
const thrown = (operation: () => unknown, code: string): void => {
  try {
    operation();
  } catch (error) {
    if (codeOf(error) === code) return;
    throw error;
  }
  throw new Error(`Expected ${code}`);
};
const results: unknown[] = [];
const measure = async (name: string, operation: () => void | Promise<void>) => {
  for (let index = 0; index < 1000; index++) await operation();
  const samplesUs: number[] = [];
  for (let sample = 0; sample < 7; sample++) {
    const start = performance.now();
    for (let index = 0; index < count; index++) await operation();
    samplesUs.push(((performance.now() - start) * 1000) / count);
  }
  results.push({ name, count, samplesUs, memory: process.memoryUsage() });
};
let release: () => void = () => {};
const gate = new Promise<void>((resolve) => {
  release = resolve;
});
callback = () => gate;
const busy = schema.createWorker();
const running = busy.triggerEvent("start", { value: 1 });
try {
  await measure("busy-trigger", () =>
    rejected(busy.triggerEvent("start", { value: 99 }), "WORKER_BUSY"),
  );
  await measure("busy-extract", () => thrown(() => busy.extract(), "WORKER_BUSY"));
} finally {
  release();
  await running;
}
if (busy.extract().pinCache[0]?.cache !== 1)
  throw new Error("Rejected busy input mutated the active trigger");
callback = async () => {
  throw new Error("own failure");
};
const failed = schema.createWorker();
await failed.triggerEvent("start", { value: 1 }).catch(() => {});
await measure("failed-trigger", () => rejected(failed.triggerEvent("start", {}), "WORKER_FAILED"));
await measure("failed-extract", () => thrown(() => failed.extract(), "WORKER_FAILED"));
const invalid = { ...baseline, pinCache: [{ uuid: "unknown", cache: 1 }] };
await measure("invalid-snapshot", () =>
  thrown(() => schema.createWorker(invalid), "INVALID_SNAPSHOT"),
);
const result = {
  platform: process.platform,
  runtime: Bun.version,
  schemaHash: createHash("sha256").update(JSON.stringify(schema.extract())).digest("hex"),
  snapshotBytes: Buffer.byteLength(JSON.stringify(baseline)),
  note: "Candidate-only rejection behavior; old Worker had different semantics and has no comparable baseline.",
  results,
};
if (output) await writeFile(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
