import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CANONICAL_ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const TIMESTAMP = 1_783_483_200_123;

function decodeTimestamp(id: string): number {
  return [...id.slice(0, 10)].reduce((time, char) => time * 32 + ALPHABET.indexOf(char), 0);
}

describe("ulid", () => {
  let generateId: typeof import("./ulid").ulid;
  let moduleIndex = 0;

  beforeEach(async () => {
    // Isolate generator state without adding a reset API or leaking mock time to other suites.
    ({ ulid: generateId } = await import(`./ulid.ts?test=${moduleIndex++}`));
  });

  afterEach(() => {
    mock.restore();
  });

  test.each([
    0,
    1,
    2 ** 31 - 1,
    2 ** 31,
    2 ** 32 - 1,
    2 ** 32,
    2 ** 32 + 1,
    TIMESTAMP,
    2 ** 48 - 1,
  ])("encodes the complete timestamp %i in canonical form", (timestamp) => {
    spyOn(Date, "now").mockReturnValue(timestamp);

    const id = generateId();

    expect(id).toMatch(CANONICAL_ULID);
    expect(decodeTimestamp(id)).toBe(timestamp);
  });

  test("generates unique, increasing IDs in one fixed millisecond", () => {
    spyOn(Date, "now").mockReturnValue(TIMESTAMP);
    // Start at zero so crossing Base32 digit boundaries is deterministic.
    spyOn(crypto, "getRandomValues").mockImplementation(
      <T extends ArrayBufferView | null>(array: T) => {
        if (array instanceof Uint8Array) array.fill(0);
        return array;
      },
    );

    const ids = Array.from({ length: 1025 }, () => generateId());

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
    expect(ids[0]?.slice(10)).toBe("0000000000000000");
    expect(ids[32]?.slice(10)).toBe("0000000000000010");
    expect(ids[1024]?.slice(10)).toBe("0000000000000100");
    for (const id of ids) {
      expect(id).toMatch(CANONICAL_ULID);
      expect(decodeTimestamp(id)).toBe(TIMESTAMP);
    }
  });

  test("reads the current clock on every call", () => {
    const now = spyOn(Date, "now").mockReturnValue(TIMESTAMP);
    const first = generateId();
    now.mockReturnValue(TIMESTAMP + 1);
    const next = generateId();
    now.mockReturnValue(TIMESTAMP - 1);
    const earlier = generateId();

    expect(decodeTimestamp(first)).toBe(TIMESTAMP);
    expect(decodeTimestamp(next)).toBe(TIMESTAMP + 1);
    expect(decodeTimestamp(earlier)).toBe(TIMESTAMP - 1);
    expect(first < next).toBe(true);
  });

  test("throws on random overflow instead of wrapping and recovers in the next millisecond", () => {
    const now = spyOn(Date, "now").mockReturnValue(0);
    spyOn(crypto, "getRandomValues").mockImplementation(
      <T extends ArrayBufferView | null>(array: T) => {
        if (array instanceof Uint8Array) array.fill(255);
        return array;
      },
    );

    expect(generateId()).toBe("0000000000ZZZZZZZZZZZZZZZZ");
    expect(() => generateId()).toThrow();
    expect(() => generateId()).toThrow();

    now.mockReturnValue(1);
    const next = generateId();
    expect(next).toMatch(CANONICAL_ULID);
    expect(decodeTimestamp(next)).toBe(1);
  });
});
