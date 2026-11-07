import { CommutatorError } from "../commutator/commutator-error";
import type { WorkerSnapshot } from "./types";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export function snapshotError(message: string): never {
  throw new CommutatorError(`Invalid worker snapshot: ${message}`);
}

/** Copy JSON without invoking getters/toJSON or silently dropping unsupported values. */
export function copyJson(value: unknown, ancestors = new Set<object>()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value === null) return snapshotError("non-JSON value");
  if (ancestors.has(value)) return snapshotError("cyclic value");
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null) {
    return snapshotError("non-JSON object");
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return snapshotError("symbol property");
  ancestors.add(value);
  try {
    if (array) {
      if (keys.length !== value.length + 1) return snapshotError("sparse or extended array");
      const result: JsonValue[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
          return snapshotError("sparse array or accessor");
        }
        result.push(copyJson(descriptor.value, ancestors));
      }
      return result;
    }
    const result: Record<string, JsonValue> = {};
    for (const key of Object.getOwnPropertyNames(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        return snapshotError("hidden property or accessor");
      }
      Object.defineProperty(result, key, {
        value: copyJson(descriptor.value, ancestors),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readSnapshot(input: unknown): WorkerSnapshot {
  const snapshot = copyJson(input);
  if (
    !isRecord(snapshot) ||
    Object.keys(snapshot).length !== 3 ||
    typeof snapshot.schemaFingerprint !== "string" ||
    !Array.isArray(snapshot.pinCache) ||
    !Array.isArray(snapshot.metaCache)
  ) {
    return snapshotError("expected schemaFingerprint, pinCache and metaCache");
  }
  const entries = (items: JsonValue[]): { uuid: string; cache: JsonValue }[] => {
    const seen = new Set<string>();
    return items.map((entry) => {
      if (
        !isRecord(entry) ||
        Object.keys(entry).length !== 2 ||
        typeof entry.uuid !== "string" ||
        !Object.hasOwn(entry, "cache") ||
        seen.has(entry.uuid)
      ) {
        return snapshotError("invalid or duplicate cache entry");
      }
      seen.add(entry.uuid);
      return { uuid: entry.uuid, cache: entry.cache! };
    });
  };
  return {
    schemaFingerprint: snapshot.schemaFingerprint,
    pinCache: entries(snapshot.pinCache),
    metaCache: entries(snapshot.metaCache),
  };
}
