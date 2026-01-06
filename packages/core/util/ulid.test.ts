import { describe, expect, test } from "bun:test";
import { ulid } from "./ulid";

describe("ulid", () => {
  test("should generate unique IDs", () => {
    const ids = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const id = ulid();
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      ids.add(id);
    }

    // Все ID должны быть уникальными
    expect(ids.size).toBe(count);
  });

  test("should generate IDs with consistent format", () => {
    const id = ulid();
    expect(id).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]+$/);
  });

  test("should handle rapid generation with same timestamp", () => {
    // Генерируем много ID подряд, чтобы покрыть случай инкремента random
    // при одинаковом времени (строки 10-18 в ulid.ts)
    const ids = new Set<string>();
    const count = 10000;

    // Используем Promise.all для максимально быстрой генерации
    const promises = Array.from({ length: count }, () => {
      return Promise.resolve(ulid());
    });

    return Promise.all(promises).then((generatedIds) => {
      generatedIds.forEach((id) => {
        expect(id).toBeDefined();
        expect(typeof id).toBe("string");
        ids.add(id);
      });

      // Все ID должны быть уникальными, даже при быстрой генерации
      expect(ids.size).toBe(count);
    });
  });

  test("should increment random part when timestamp is the same", () => {
    // Этот тест проверяет логику инкремента random при одинаковом времени
    // Особенно случай, когда random[i] достигает 0xff (строки 16-17)
    const ids: string[] = [];
    const count = 300; // Достаточно, чтобы покрыть инкремент через несколько байтов

    // Генерируем ID синхронно, чтобы максимизировать шанс одинакового времени
    for (let i = 0; i < count; i++) {
      ids.push(ulid());
    }

    // Все ID должны быть уникальными
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(count);

    // Проверяем, что ID имеют правильный формат
    ids.forEach((id) => {
      expect(id.length).toBeGreaterThan(0);
      expect(id).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]+$/);
    });
  });

  test("should handle overflow in random part", () => {
    // Генерируем много ID подряд, чтобы покрыть случай,
    // когда random[i] достигает 0xff и обнуляется (строка 17)
    const ids = new Set<string>();
    const count = 5000; // Достаточно для покрытия overflow

    for (let i = 0; i < count; i++) {
      const id = ulid();
      ids.add(id);
    }

    // Все ID должны быть уникальными, даже при overflow
    expect(ids.size).toBe(count);
  });
});
