import { expect, test } from "bun:test";
import { CommonDataType, Commutator } from "../commutator";
import type { WorkerSnapshot } from "./types";

// Test-only Flow/Agents contract. None of this orchestration is library behavior.
class FlowConsumer {
  readonly agents = new Map<string, { payload: string; agentId: string; receipt: string }>();
  unknown: string | undefined;
  owner = 0;
  committed: WorkerSnapshot | undefined;
  claim() { return ++this.owner; }
  operationId(action: string, iteration: number) {
    return JSON.stringify(["flow-1", "definition-v1", action, iteration]);
  }
  start(operationId: string, payload: string, loseResponse = false) {
    if (this.unknown) throw new Error("UNKNOWN_OUTCOME");
    const existing = this.agents.get(operationId);
    if (existing && existing.payload !== payload) throw new Error("PAYLOAD_MISMATCH");
    const result = existing ?? {
      payload,
      agentId: `agent-${this.agents.size + 1}`,
      receipt: `receipt:${operationId}`,
    };
    this.agents.set(operationId, result);
    if (loseResponse) throw new Error("LOST_RESPONSE");
    return result;
  }
  reconcile(operationId: string, receipt: string) {
    if (this.unknown !== operationId || this.agents.get(operationId)?.receipt !== receipt) {
      throw new Error("INVALID_RECEIPT");
    }
    this.unknown = undefined;
  }
  commit(owner: number, operationId: string, receipt: string, snapshot: WorkerSnapshot) {
    if (owner !== this.owner) throw new Error("STALE_OWNER");
    if (this.unknown) throw new Error("UNKNOWN_OUTCOME");
    if (this.agents.get(operationId)?.receipt !== receipt) throw new Error("INVALID_RECEIPT");
    this.committed = structuredClone(snapshot);
  }
}

test("Flow retry after lost Agents response uses stable operationId and one agentId", async () => {
  const flow = new FlowConsumer();
  const operationId = flow.operationId("research", 0);
  let loseResponse = true;
  let receipt = "";
  const schema = Commutator.initialize()
    .defineEvent("start", {
      pinsOut: { payload: { type: CommonDataType.String } }, execPinsOut: { next: null },
    })
    .defineFunction("agent", {
      pinsIn: { payload: { type: CommonDataType.String } },
      pinsOut: { agentId: { type: CommonDataType.String } },
      execPinsIn: { in: null }, execPinsOut: {},
      exec: async ({ pinsIn, exec }) => {
        const result = flow.start(operationId, pinsIn.payload ?? "", loseResponse);
        receipt = result.receipt;
        await exec({ pinsOut: { agentId: result.agentId }, execPinOut: null, meta: null });
      },
    }).createSchema();
  const event = schema.createEvent("start");
  const agent = schema.createFunction("agent");
  event.wire("next", agent, "in").wire("payload", agent, "payload");
  const baseline = schema.createWorker().extract();
  const oldOwner = flow.claim();
  const failed = schema.createWorker(baseline);
  await expect(failed.triggerEvent("start", { payload: "task" })).rejects.toThrow("LOST_RESPONSE");
  expect(() => failed.extract()).toThrow("WORKER_FAILED");
  expect(flow.agents.size).toBe(1);
  expect(baseline.pinCache).toEqual([]);
  loseResponse = false;
  const newOwner = flow.claim();
  const retry = schema.createWorker(baseline);
  await retry.triggerEvent("start", { payload: "task" });
  expect(flow.agents.size).toBe(1);
  expect(retry.extract().pinCache.map((entry) => entry.cache)).toContain("agent-1");
  expect(() => flow.start(operationId, "different payload")).toThrow("PAYLOAD_MISMATCH");
  expect(() => flow.commit(oldOwner, operationId, receipt, retry.extract())).toThrow("STALE_OWNER");
  expect(() => flow.commit(newOwner, operationId, "wrong", retry.extract())).toThrow("INVALID_RECEIPT");
  flow.commit(newOwner, operationId, receipt, retry.extract());
  expect(flow.committed).toEqual(retry.extract());
  expect(flow.start(flow.operationId("research", 1), "task").agentId).toBe("agent-2");
  expect(flow.start(flow.operationId("write", 0), "task").agentId).toBe("agent-3");
  expect(new Set([operationId, flow.operationId("research", 1), flow.operationId("write", 0)]).size).toBe(3);
});

test("unknown outcome blocks fresh launch and commit until a matching receipt reconciles it", () => {
  const flow = new FlowConsumer();
  const operationId = flow.operationId("research", 0);
  const result = flow.start(operationId, "task");
  flow.unknown = operationId;
  expect(() => flow.start(flow.operationId("write", 0), "task")).toThrow("UNKNOWN_OUTCOME");
  expect(() => flow.start(operationId, "task")).toThrow("UNKNOWN_OUTCOME");
  const snapshot = Commutator.initialize().createSchema().createWorker().extract();
  expect(() => flow.commit(flow.claim(), operationId, result.receipt, snapshot)).toThrow("UNKNOWN_OUTCOME");
  expect(() => flow.reconcile(operationId, "wrong")).toThrow("INVALID_RECEIPT");
  expect(flow.agents.size).toBe(1);
  flow.reconcile(operationId, result.receipt);
  expect(flow.start(operationId, "task").agentId).toBe(result.agentId);
  flow.commit(flow.owner, operationId, result.receipt, snapshot);
});
