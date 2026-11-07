import { expect, test } from "bun:test";
import { CommonDataType, Commutator } from "../commutator";
import { FlowConsumer } from "./fixtures/flow-consumer";

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

for (const lookupMode of ["unreachable", "missing"] as const) {
  test(`lost provider response with ${lookupMode} lookup automatically blocks launches and commit`, async () => {
    const flow = new FlowConsumer();
    flow.lookupMode = lookupMode;
    const operationId = flow.operationId("research", 0);
    const schema = Commutator.initialize()
      .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("agent", {
        pinsIn: {}, pinsOut: {}, execPinsIn: { in: null }, execPinsOut: {},
        exec: async () => { flow.start(operationId, "task", true); },
      }).createSchema();
    schema.createEvent("start").wire("next", schema.createFunction("agent"), "in");
    const baseline = schema.createWorker().extract();
    const owner = flow.claim();
    const worker = schema.createWorker(baseline);
    await expect(worker.triggerEvent("start", {})).rejects.toThrow("UNKNOWN_OUTCOME");
    expect(() => worker.extract()).toThrow("WORKER_FAILED");
    expect(flow.unknown).toBe(operationId);
    expect(flow.agents.size).toBe(1);
    const result = flow.agents.get(operationId)!; // Evidence fixture, not a consumer lookup.
    expect(() => flow.start(flow.operationId("write", 0), "task")).toThrow("UNKNOWN_OUTCOME");
    expect(() => flow.start(operationId, "task")).toThrow("UNKNOWN_OUTCOME");
    expect(() => flow.commit(owner, operationId, result.receipt, baseline)).toThrow("UNKNOWN_OUTCOME");
    expect(flow.committed).toBeUndefined();
    flow.lookupMode = "available";
    expect(() => flow.reconcile(operationId, "wrong")).toThrow("INVALID_RECEIPT");
    expect(() => flow.reconcile(flow.operationId("write", 0), result.receipt)).toThrow("INVALID_RECEIPT");
    expect(flow.unknown).toBe(operationId);
    flow.reconcile(operationId, result.receipt);
    expect(flow.start(operationId, "task").agentId).toBe(result.agentId);
    expect(flow.agents.size).toBe(1);
    expect(() => flow.start(operationId, "changed task")).toThrow("PAYLOAD_MISMATCH");
    const currentOwner = flow.claim();
    expect(() => flow.commit(owner, operationId, result.receipt, baseline)).toThrow("STALE_OWNER");
    flow.commit(currentOwner, operationId, result.receipt, baseline);
    expect(flow.committed).toEqual(baseline);
    expect(baseline.pinCache).toEqual([]);
  });
}
