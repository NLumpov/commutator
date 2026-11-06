import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("./fixtures/exec-cycle-child.ts", import.meta.url));

async function runChild(mode: "stress" | "interrupt") {
  const child = spawn(process.execPath, [fixture, mode], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  child.stdout.on("data", (data) => {
    stdout += data;
    if (mode === "interrupt" && stdout.includes("interrupt-ready")) child.kill("SIGTERM");
  });
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => resolve({ code, signal }));
    },
  );
  // Emergency termination of an owned child; not a performance acceptance budget.
  const deadline = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, 30_000);
  try {
    return { ...(await exited), stdout, stderr, timedOut };
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await exited;
  }
}

test("long cycles settle and release retained continuations in an owned child", async () => {
  const result = await runChild("stress");
  expect(result.timedOut).toBe(false);
  expect(result.stderr).toBe("");
  expect(result.code).toBe(0);
  expect(result.signal).toBeNull();
  expect(JSON.parse(result.stdout)).toMatchObject({
    status: "PASS",
    limited: { entered: 20_000, settled: 20_000 },
  });
}, 35_000);

test("a running cyclic child yields to timers and is awaited after termination", async () => {
  const result = await runChild("interrupt");
  expect(result.timedOut).toBe(false);
  expect(result.stdout).toContain("interrupt-ready");
  expect(result.signal).toBe("SIGTERM");
}, 35_000);
