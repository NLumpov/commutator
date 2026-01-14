import { describe, expect, test } from "bun:test";
import { Queue } from "./queue";

describe("Queue", () => {
  test("should create empty queue", () => {
    const queue = new Queue<number>();
    expect(queue.size).toBe(0);
    expect(queue.size === 0).toBe(true);
  });

  test("should enqueue elements", () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(queue.size).toBe(3);
    expect(queue.size === 0).toBe(false);
  });

  test("should dequeue elements in FIFO order", () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(queue.dequeue()).toBe(1);
    expect(queue.dequeue()).toBe(2);
    expect(queue.dequeue()).toBe(3);
    expect(queue.size).toBe(0);
    expect(queue.size === 0).toBe(true);
  });

  test("should peek without removing", () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);

    expect(queue.peek()).toBe(1);
    expect(queue.size).toBe(2);
    expect(queue.dequeue()).toBe(1);
    expect(queue.peek()).toBe(2);
  });

  test("should return undefined on dequeue from empty queue", () => {
    const queue = new Queue<number>();
    expect(queue.dequeue()).toBeUndefined();
  });

  test("should return undefined on peek from empty queue", () => {
    const queue = new Queue<number>();
    expect(queue.peek()).toBeUndefined();
  });

  test("should clear queue", () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    queue.clear();
    expect(queue.size).toBe(0);
    expect(queue.size === 0).toBe(true);
    expect(queue.dequeue()).toBeUndefined();
  });

  test("should convert to array", () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(queue.toArray()).toEqual([1, 2, 3]);
    expect(queue.size).toBe(3); // toArray не должен изменять очередь
  });

  test("should handle single element", () => {
    const queue = new Queue<number>();
    queue.enqueue(42);

    expect(queue.size).toBe(1);
    expect(queue.peek()).toBe(42);
    expect(queue.dequeue()).toBe(42);
    expect(queue.size === 0).toBe(true);
  });

  test("should handle enqueue after dequeue", () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.dequeue();
    queue.enqueue(3);

    expect(queue.size).toBe(2);
    expect(queue.dequeue()).toBe(2);
    expect(queue.dequeue()).toBe(3);
  });

  test("should work with different types", () => {
    const stringQueue = new Queue<string>();
    stringQueue.enqueue("a");
    stringQueue.enqueue("b");
    expect(stringQueue.dequeue()).toBe("a");

    const objectQueue = new Queue<{ id: number }>();
    objectQueue.enqueue({ id: 1 });
    objectQueue.enqueue({ id: 2 });
    const dequeued = objectQueue.dequeue();
    expect(dequeued).toBeDefined();
    expect(dequeued?.id).toBe(1);
  });

  test("should maintain FIFO order with many elements", () => {
    const queue = new Queue<number>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      queue.enqueue(i);
    }

    expect(queue.size).toBe(count);

    for (let i = 0; i < count; i++) {
      expect(queue.dequeue()).toBe(i);
    }

    expect(queue.size === 0).toBe(true);
  });

  test("should handle alternating enqueue and dequeue", () => {
    const queue = new Queue<number>();

    for (let i = 0; i < 100; i++) {
      queue.enqueue(i);
      if (i % 2 === 0) {
        queue.dequeue();
      }
    }

    // После 100 итераций должно остаться 50 элементов
    expect(queue.size).toBe(50);
    // Первый элемент будет 50, так как мы удаляем на каждой четной итерации
    expect(queue.peek()).toBe(50);
  });
});
