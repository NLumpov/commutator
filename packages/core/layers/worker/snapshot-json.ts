import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import stringify from "fast-json-stable-stringify";
import { CommutatorExecutionError } from "../commutator";
import type { SchemaSnapshot } from "../schema";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Validate and detach without JSON.stringify silently dropping unsupported values. */
export function cloneJson<T>(value: T): T {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  const ancestors = new Set<object>();
  const invalid = (): never => {
    throw new CommutatorExecutionError("INVALID_JSON");
  };
  const copy = (input: unknown): unknown => {
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input !== "object" || input === null || ancestors.has(input)) return invalid();
    const array = Array.isArray(input);
    const prototype = Object.getPrototypeOf(input);
    if (
      array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null
    )
      return invalid();
    ancestors.add(input);
    const keys = Reflect.ownKeys(input);
    if (array) {
      if (keys.length !== input.length + 1) return invalid();
      const output = new Array<unknown>(input.length);
      for (let index = 0; index < input.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(input, index);
        if (!descriptor?.enumerable || !("value" in descriptor)) return invalid();
        output[index] = copy(descriptor.value);
      }
      ancestors.delete(input);
      return output;
    }
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor))
        return invalid();
      const value = copy(descriptor.value);
      if (key === "__proto__") {
        Object.defineProperty(output, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else output[key] = value;
    }
    ancestors.delete(input);
    return output;
  };
  return copy(value) as T;
}

/** Serialize the live schema without coercing non-JSON graph values to null. */
function serializeSchema(schema: SchemaSnapshot): string {
  // Built-in optional schema properties may be undefined. User config/default
  // subtrees must be finite JSON, including every nested object property.
  const strictValues = new WeakSet<object>();
  const markStrict = (value: unknown): void => {
    if (value !== null && typeof value === "object") strictValues.add(value);
  };
  for (const node of schema.nodes)
    markStrict(Object.getOwnPropertyDescriptor(node, "config")?.value);
  for (const pin of schema.pinInstances)
    markStrict(Object.getOwnPropertyDescriptor(pin, "default")?.value);
  const invalid = (): never => {
    throw new CommutatorExecutionError("INVALID_JSON");
  };
  const inspect = (value: unknown, optional: boolean): void => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (value === undefined && optional) return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value !== "object" || value === null) invalid();
    const prototype = Object.getPrototypeOf(value);
    if (
      Array.isArray(value)
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    )
      invalid();
    // Inspect children before native stringify can invoke their toJSON hooks.
    const toJSON = Object.getOwnPropertyDescriptor(value, "toJSON");
    if (toJSON && (!("value" in toJSON) || typeof toJSON.value === "function")) invalid();
  };
  try {
    return JSON.stringify(schema, (_key, value: unknown) => {
      if (value !== null && typeof value === "object") {
        const array = Array.isArray(value);
        const strict = strictValues.has(value);
        const keys = Reflect.ownKeys(value);
        if (array) {
          if (keys.length !== value.length + 1) return invalid();
          for (let index = 0; index < value.length; index++) {
            const descriptor = Object.getOwnPropertyDescriptor(value, index);
            if (!descriptor?.enumerable || !("value" in descriptor)) return invalid();
            inspect(descriptor.value, false);
            if (strict) markStrict(descriptor.value);
          }
        } else {
          for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor))
              return invalid();
            inspect(descriptor.value, !strict);
            if (strict) markStrict(descriptor.value);
          }
        }
      }
      return value;
    });
  } catch (error) {
    if (error instanceof CommutatorExecutionError) throw error;
    return invalid();
  }
}

/** Compare live descriptors with one detached graph; never read getters/toJSON. */
function matchesSchema(schema: SchemaSnapshot, previous: SchemaSnapshot): boolean {
  const strictRoots = new WeakSet<object>();
  for (const node of schema.nodes) {
    const value = Object.getOwnPropertyDescriptor(node, "config")?.value;
    if (value !== null && typeof value === "object") strictRoots.add(value);
  }
  for (const pin of schema.pinInstances) {
    const value = Object.getOwnPropertyDescriptor(pin, "default")?.value;
    if (value !== null && typeof value === "object") strictRoots.add(value);
  }
  const same = (value: unknown, baseline: unknown, strict: boolean): boolean => {
    if (value === null || typeof value === "string" || typeof value === "boolean")
      return value === baseline;
    if (typeof value === "number") return Number.isFinite(value) && value === baseline;
    if (
      typeof value !== "object" ||
      value === null ||
      baseline === null ||
      typeof baseline !== "object"
    )
      return false;
    const array = Array.isArray(value);
    if (array !== Array.isArray(baseline)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (
      array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null
    )
      return false;
    const strictValue = strict || strictRoots.has(value);
    const keys = Reflect.ownKeys(value);
    if (array && Array.isArray(baseline)) {
      if (value.length !== baseline.length || keys.length !== value.length + 1) return false;
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, index);
        if (
          !descriptor?.enumerable ||
          !("value" in descriptor) ||
          !same(descriptor.value, baseline[index], strictValue)
        )
          return false;
      }
      return true;
    }
    const baselineKeys = Object.keys(baseline);
    let count = keys.length;
    if (count !== baselineKeys.length) {
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor))
          return false;
        if (descriptor.value === undefined && !strictValue) count--;
      }
      if (count !== baselineKeys.length) return false;
    }
    for (const key of baselineKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor?.enumerable ||
        !("value" in descriptor) ||
        !same(descriptor.value, (baseline as Record<string, unknown>)[key], strictValue)
      )
        return false;
    }
    return true;
  };
  return same(schema, previous, false);
}

// One detached graph per live schema, shared across workers; no history.
const fingerprints = new WeakMap<object, { graph: SchemaSnapshot; fingerprint: string }>();

/** Object key order is irrelevant; array order (roots, pins and wires) is semantic. */
export function schemaFingerprint(schema: SchemaSnapshot, identity: object): string {
  const previous = fingerprints.get(identity);
  if (previous) {
    try {
      if (matchesSchema(schema, previous.graph)) return previous.fingerprint;
    } catch {
      throw new CommutatorExecutionError("INVALID_JSON");
    }
  }
  // A mismatch may be invalid, including beyond the first differing value.
  // Validate the whole graph before canonicalization can observe any hooks.
  const graph: SchemaSnapshot = JSON.parse(serializeSchema(schema));
  const canonical = stringify(graph);
  const fingerprint = `sha256:${bytesToHex(sha256(utf8ToBytes(canonical)))}`;
  fingerprints.set(identity, { graph, fingerprint });
  return fingerprint;
}
