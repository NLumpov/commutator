import { expect, test } from "bun:test";
import { copyJson } from "./snapshot-json";

test("JSON copies preserve own keys without invoking inherited setters or prototype mutation", () => {
  let writes = 0;
  Object.defineProperty(Object.prototype, "snapshotSetter", {
    configurable: true,
    set() { writes++; },
  });
  Object.defineProperty(Object.prototype, "snapshotReadonly", {
    configurable: true,
    value: 0,
    writable: false,
  });
  try {
    const input = JSON.parse('{"__proto__":{"safe":true},"constructor":1,"snapshotSetter":2,"snapshotReadonly":3}');
    for (const canonical of [false, true]) {
      const result = copyJson(input, canonical);
      if (result === null || typeof result !== "object") throw new Error("object expected");
      expect(result).toEqual(input);
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(Object.hasOwn(result, "__proto__")).toBe(true);
      expect(Object.hasOwn(result, "snapshotSetter")).toBe(true);
      expect(Object.hasOwn(result, "snapshotReadonly")).toBe(true);
    }
    expect(writes).toBe(0);
  } finally {
    Reflect.deleteProperty(Object.prototype, "snapshotSetter");
    Reflect.deleteProperty(Object.prototype, "snapshotReadonly");
  }
});

test("JSON copies preserve aliases and reject symbols, hidden keys and extended arrays", () => {
  const shared = { z: 1, a: [2] };
  const copied = copyJson({ a: shared, b: shared });
  expect(copied).toEqual({ a: shared, b: shared });
  if (copied === null || typeof copied !== "object" || Array.isArray(copied)) throw new Error("object expected");
  expect(copied.a).toBe(copied.b);
  expect(copied.a).not.toBe(shared);
  for (const canonical of [false, true]) {
    expect(() => copyJson({ [Symbol("key")]: 1 }, canonical)).toThrow("symbol property");
    expect(() => copyJson(Object.defineProperty({}, "hidden", { value: 1 }), canonical)).toThrow("hidden property");
    expect(() => copyJson(Object.assign([1], { extra: 2 }), canonical)).toThrow();
    expect(() => copyJson(Object.assign([, 1], { [Symbol("compensates hole")]: 2 }), canonical)).toThrow();
  }
});
