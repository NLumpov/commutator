import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CommonDataType, Commutator } from "../commutator";

const fixture = fileURLToPath(new URL("./fixtures/recovery-child.ts", import.meta.url));
async function child(directory: string, mode: string) {
  const processChild = spawn(process.execPath, [fixture, directory, mode]);
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  processChild.stdout.on("data", (data) => {
    stdout += data;
    if (stdout.includes("kill-ready")) processChild.kill("SIGKILL");
  });
  processChild.stderr.on("data", (data) => { stderr += data; });
  const deadline = setTimeout(() => { timedOut = true; processChild.kill("SIGKILL"); }, 5000);
  try {
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      processChild.on("error", reject);
      processChild.on("close", (code, signal) => resolve({ code, signal }));
    });
    expect(timedOut).toBe(false);
    expect(stderr).toBe("");
    return result;
  } finally { clearTimeout(deadline); }
}

for (const point of ["inside", "after"]) {
  test(`SIGKILL ${point} B replays A/B/tail but preserves previously committed trigger`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "commutator-recovery-"));
    try {
      expect(await child(directory, "init")).toEqual({ code: 0, signal: null });
      const baseline = readFileSync(join(directory, "baseline.json"), "utf8");
      expect(await child(directory, point)).toEqual({ code: null, signal: "SIGKILL" });
      expect(readFileSync(join(directory, "baseline.json"), "utf8")).toBe(baseline);
      expect(await child(directory, "recover")).toEqual({ code: 0, signal: null });
      expect(readFileSync(join(directory, "trace"), "utf8").trim().split("\n")).toEqual([
        "committed", "A", "B", "A", "B", "tail",
      ]);
      const restored = JSON.parse(readFileSync(join(directory, "result.json"), "utf8"));
      expect(restored.metaCache).toHaveLength(3);
      expect(restored.metaCache.map((entry: { cache: number }) => entry.cache)).toEqual([1, 1, 1]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }, 20_000);
}

test("completed trigger history keeps snapshot bounded and records heap observations", async () => {
  const schema = Commutator.initialize()
    .defineEvent("tick", { pinsOut: { value: { type: CommonDataType.Number } }, execPinsOut: { next: null } })
    .defineFunction("state", {
      pinsIn: {}, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: {},
      meta: { type: CommonDataType.Number },
      exec: async ({ exec }) => { await exec({ pinsOut: {}, execPinOut: null, meta: 1 }); },
    }).createSchema();
  schema.createEvent("tick").wire("next", schema.createFunction("state"), "in");
  const worker = schema.createWorker();
  await worker.triggerEvent("tick", { value: 1 });
  const expected = JSON.stringify(worker.extract());
  const samples = [];
  for (const batch of [100, 1000, 5000]) {
    for (let i = 0; i < batch; i++) await worker.triggerEvent("tick", { value: 1 });
    Bun.gc(true);
    expect(JSON.stringify(worker.extract())).toBe(expected);
    expect(worker.extract().pinCache).toHaveLength(1);
    expect(worker.extract().metaCache).toHaveLength(1);
    samples.push({ batch, bytes: expected.length, ...process.memoryUsage() });
  }
  console.log("bounded-state-observation", JSON.stringify(samples));
  // Observation only: paired RSS/latency acceptance belongs to the coordinator.
});
