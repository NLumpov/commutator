import type { WorkerSnapshot } from "../types";

// Test-only Flow/Agents contract. None of this orchestration is library behavior.
export class FlowConsumer {
  readonly agents = new Map<string, { payload: string; agentId: string; receipt: string }>();
  unknown: string | undefined;
  lookupMode: "available" | "unreachable" | "missing" = "available";
  owner = 0;
  committed: WorkerSnapshot | undefined;
  claim() {
    return ++this.owner;
  }
  operationId(action: string, iteration: number) {
    return JSON.stringify(["flow-1", "definition-v1", action, iteration]);
  }
  // Fake provider: accepts the request before its response can be lost.
  private providerStart(operationId: string, payload: string, loseResponse: boolean) {
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
  private providerLookup(operationId: string) {
    if (this.lookupMode === "unreachable") throw new Error("PROVIDER_UNAVAILABLE");
    if (this.lookupMode === "missing") return undefined;
    return this.agents.get(operationId);
  }
  start(operationId: string, payload: string, loseResponse = false) {
    if (this.unknown) throw new Error("UNKNOWN_OUTCOME");
    try {
      return this.providerStart(operationId, payload, loseResponse);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "LOST_RESPONSE") throw error;
      let confirmed = false;
      try {
        confirmed = this.providerLookup(operationId) !== undefined;
      } catch {
        /* No authoritative outcome. */
      }
      if (!confirmed) {
        this.unknown = operationId;
        throw new Error("UNKNOWN_OUTCOME");
      }
      // A trustworthy receipt plus operationId dedupe permits a same-key retry.
      throw error;
    }
  }
  reconcile(operationId: string, receipt: string) {
    if (this.unknown !== operationId || this.providerLookup(operationId)?.receipt !== receipt) {
      throw new Error("INVALID_RECEIPT");
    }
    this.unknown = undefined;
  }
  commit(owner: number, operationId: string, receipt: string, snapshot: WorkerSnapshot) {
    if (owner !== this.owner) throw new Error("STALE_OWNER");
    if (this.unknown) throw new Error("UNKNOWN_OUTCOME");
    if (this.providerLookup(operationId)?.receipt !== receipt) throw new Error("INVALID_RECEIPT");
    this.committed = structuredClone(snapshot);
  }
}
