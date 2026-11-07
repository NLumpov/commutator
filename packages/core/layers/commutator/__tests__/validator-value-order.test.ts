import { expect, test } from "bun:test";
import { CommutatorValidator } from "../commutator-validator";
import { CommonDataType } from "../enums";

test("null validation never reads the field type", () => {
  const field: any = Object.defineProperty({}, "type", {
    get() { throw new Error("null must not read type"); },
  });
  expect(new CommutatorValidator({}).validateFieldValue(field, null)).toBe(true);
});

test("validation preserves dynamic type reads and their exceptions", () => {
  let reads = 0;
  const failure = new Error("third type read");
  const field: any = Object.defineProperty({}, "type", {
    get() {
      if (++reads === 3) throw failure;
      return CommonDataType.Number;
    },
  });
  expect(() => new CommutatorValidator({}).validateFieldValue(field, 1)).toThrow(failure);
  expect(reads).toBe(3);
});

test("nested property reads precede validation in the original LIFO order", () => {
  const trace: string[] = [];
  const scalar = (name: string): any => Object.defineProperty({}, "type", {
    get() { trace.push(`check:${name}`); return CommonDataType.Number; },
  });
  const field = {
    type: CommonDataType.Object,
    properties: { a: scalar("a"), b: scalar("b") },
  } as const;
  const value = {
    get a() { trace.push("read:a"); return 1; },
    get b() { trace.push("read:b"); return 2; },
  };
  expect(new CommutatorValidator({}).validateFieldValue(field, value)).toBe(true);
  expect(trace.slice(0, 2)).toEqual(["read:a", "read:b"]);
  const checks = trace.filter((entry) => entry.startsWith("check:"));
  expect(checks[0]).toBe("check:b");
  expect(checks.at(-1)).toBe("check:a");
});

test("scalar validation retains existing numeric and empty-container semantics", () => {
  const validator = new CommutatorValidator({ Alias: { type: CommonDataType.Number } });
  expect(validator.validateFieldValue({ type: CommonDataType.Number }, NaN)).toBe(true);
  expect(validator.validateFieldValue({ type: CommonDataType.Date }, Infinity)).toBe(true);
  expect(validator.validateFieldValue({ type: "Alias" }, 1)).toBe(true);
  expect(validator.validateFieldValue({ type: "Alias" }, "invalid")).toBe(false);
  expect(validator.validateFieldValue({ type: CommonDataType.Object, properties: {} }, {})).toBe(true);
  expect(validator.validateFieldValue({ type: CommonDataType.Array, itemType: { type: CommonDataType.Number } }, [])).toBe(true);
});
