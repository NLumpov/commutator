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

/** Copy finite JSON data, preserving aliases but rejecting cycles and implicit conversions. */
export function copyJson(value: unknown, canonical = false): JsonValue {
  return createJsonCopier(canonical)(value);
}

/** Share copies within one synchronous API call, never across live Schema changes. */
export function createJsonCopier(canonical = false): (value: unknown) => JsonValue {
  const ancestors = new Set<object>();
  const copies = new Map<object, JsonValue>();
  return visit;

  function visit(value: unknown): JsonValue {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "object" || value === null) return snapshotError("non-JSON value");
    if (ancestors.has(value)) return snapshotError("cyclic value");
    const previous = copies.get(value);
    if (previous !== undefined) return previous;
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (
      array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null
    ) {
      return snapshotError("non-JSON object");
    }
    const keys = Reflect.ownKeys(value);
    ancestors.add(value);
    try {
      if (array) {
        if (keys.length !== value.length + 1) return snapshotError("sparse or extended array");
        const result: JsonValue[] = [];
        copies.set(value, result);
        for (let index = 0; index < value.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
            return snapshotError("sparse array or accessor");
          }
          result.push(visit(descriptor.value));
        }
        return result;
      }
      const result: Record<string, JsonValue> = {};
      copies.set(value, result);
      if (canonical) {
        // Check before sorting: converting a Symbol to a string would throw first.
        for (const key of keys) if (typeof key !== "string") snapshotError("symbol property");
        keys.sort();
      }
      for (const key of keys) {
        if (typeof key !== "string") return snapshotError("symbol property");
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
          return snapshotError("hidden property or accessor");
        }
        const copied = visit(descriptor.value);
        // Do not invoke inherited setters (including __proto__) or writable checks.
        if (key in result) {
          Object.defineProperty(result, key, {
            value: copied,
            enumerable: true,
            writable: true,
            configurable: true,
          });
        } else {
          result[key] = copied;
        }
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
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
  function validateEntries(
    items: JsonValue[],
  ): asserts items is { uuid: string; cache: JsonValue }[] {
    const seen = new Set<string>();
    for (const entry of items) {
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
    }
  }
  validateEntries(snapshot.pinCache);
  validateEntries(snapshot.metaCache);
  return {
    schemaFingerprint: snapshot.schemaFingerprint,
    pinCache: snapshot.pinCache,
    metaCache: snapshot.metaCache,
  };
}
