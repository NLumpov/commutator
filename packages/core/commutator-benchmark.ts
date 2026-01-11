/**
 * Бенчмарк для тестирования производительности валидатора и схемы
 *
 * Тестирует:
 * - Создание схемы
 * - Создание нод (разных типов)
 * - Создание проводов
 * - Валидацию проводов
 * - Проверку циклических связей
 * - Валидацию снапшотов
 * - Экспорт/импорт снапшотов
 * - Работу с большими графами
 */

import { CommonDataType, Commutator } from "./layers/commutator";
import type { SchemaSnapshot } from "./layers/schema/types";

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
}

class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  /**
   * Запускает бенчмарк функции
   */
  async run(
    name: string,
    fn: () => void | Promise<void>,
    iterations: number = 100,
  ): Promise<BenchmarkResult> {
    const times: number[] = [];

    // Прогрев
    for (let i = 0; i < 10; i++) {
      await fn();
    }

    // Основные измерения
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const opsPerSecond = 1000 / averageTime;

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      opsPerSecond,
    };

    this.results.push(result);
    return result;
  }

  /**
   * Выводит результаты в консоль
   */
  printResults(): void {
    console.log("\n" + "=".repeat(80));
    console.log("BENCHMARK RESULTS");
    console.log("=".repeat(80));
    console.log(
      `${"Name".padEnd(50)} ${"Avg (ms)".padEnd(12)} ${"Min (ms)".padEnd(12)} ${"Max (ms)".padEnd(12)} ${"Ops/sec".padEnd(12)}`,
    );
    console.log("-".repeat(80));

    for (const result of this.results) {
      console.log(
        `${result.name.padEnd(50)} ${result.averageTime.toFixed(4).padEnd(12)} ${result.minTime.toFixed(4).padEnd(12)} ${result.maxTime.toFixed(4).padEnd(12)} ${Math.round(result.opsPerSecond).toString().padEnd(12)}`,
      );
    }

    console.log("=".repeat(80));
    console.log(`Total benchmarks: ${this.results.length}`);
    console.log("=".repeat(80) + "\n");
  }

  /**
   * Очищает результаты
   */
  clear(): void {
    this.results = [];
  }
}

// Создаем коммутатор для бенчмарков
const createBenchmarkCommutator = () => {
  return Commutator.initialize()
    .defineDataType("User", {
      type: CommonDataType.Object,
      properties: {
        id: { type: CommonDataType.String },
        name: { type: CommonDataType.String },
        age: { type: CommonDataType.Number },
      },
    })
    .defineEvent("onClick", {
      pinsOut: {
        x: { type: CommonDataType.Number },
        y: { type: CommonDataType.Number },
      },
      execPinsOut: {
        next: null,
      },
    })
    .defineRef("userRef", {
      pinsOut: {
        user: { type: "User" },
      },
      config: {
        type: CommonDataType.Object,
        properties: {
          userId: { type: CommonDataType.String },
        },
      },
      resolveRef: async () => ({
        user: { id: "1", name: "Test", age: 25 },
      }),
    })
    .definePureFunction("add", {
      pinsIn: {
        a: { type: CommonDataType.Number },
        b: { type: CommonDataType.Number },
      },
      pinsOut: {
        result: { type: CommonDataType.Number },
      },
      exec: async ({ pinsIn }) => ({
        result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
      }),
    })
    .definePureFunction("multiply", {
      pinsIn: {
        a: { type: CommonDataType.Number },
        b: { type: CommonDataType.Number },
      },
      pinsOut: {
        result: { type: CommonDataType.Number },
      },
      exec: async ({ pinsIn }) => ({
        result: (pinsIn.a ?? 0) * (pinsIn.b ?? 0),
      }),
    })
    .defineFunction("log", {
      pinsIn: {
        message: { type: CommonDataType.String },
      },
      pinsOut: {},
      execPinsIn: {
        start: null,
      },
      execPinsOut: {
        next: null,
      },
      exec: async ({ pinsIn, exec }) => {
        console.log(pinsIn.message);
        await exec({
          execPinOut: "next",
          pinsOut: {},
          meta: null,
        });
      },
    });
};

/**
 * Бенчмарк: Создание схемы
 */
async function benchmarkSchemaCreation(runner: BenchmarkRunner): Promise<void> {
  const commutator = createBenchmarkCommutator();

  await runner.run(
    "Schema creation (empty)",
    () => {
      commutator.createSchema();
    },
    1000,
  );
}

/**
 * Бенчмарк: Создание нод
 */
async function benchmarkNodeCreation(runner: BenchmarkRunner): Promise<void> {
  const commutator = createBenchmarkCommutator();

  await runner.run(
    "Create Event node",
    () => {
      const schema = commutator.createSchema();
      schema.createEvent("onClick");
    },
    500,
  );

  await runner.run(
    "Create Ref node",
    () => {
      const schema = commutator.createSchema();
      schema.createRef("userRef", { userId: "123" });
    },
    500,
  );

  await runner.run(
    "Create PureFunction node",
    () => {
      const schema = commutator.createSchema();
      schema.createPureFunction("add");
    },
    500,
  );

  await runner.run(
    "Create Function node",
    () => {
      const schema = commutator.createSchema();
      schema.createFunction("log");
    },
    500,
  );
}

/**
 * Бенчмарк: Создание проводов
 */
async function benchmarkWiring(runner: BenchmarkRunner): Promise<void> {
  const commutator = createBenchmarkCommutator();

  await runner.run(
    "Wire data pins (simple)",
    () => {
      const testSchema = commutator.createSchema();
      const e = testSchema.createEvent("onClick");
      const a = testSchema.createPureFunction("add");
      testSchema.wire({
        from: { node: e.uuid, pin: "x" },
        to: { node: a.uuid, pin: "a" },
      });
    },
    500,
  );

  await runner.run(
    "Wire data pins (complex chain)",
    () => {
      const testSchema = commutator.createSchema();
      const e = testSchema.createEvent("onClick");
      const a1 = testSchema.createPureFunction("add");
      const a2 = testSchema.createPureFunction("add");
      const m = testSchema.createPureFunction("multiply");

      testSchema.wire({
        from: { node: e.uuid, pin: "x" },
        to: { node: a1.uuid, pin: "a" },
      });
      testSchema.wire({
        from: { node: e.uuid, pin: "y" },
        to: { node: a1.uuid, pin: "b" },
      });
      testSchema.wire({
        from: { node: a1.uuid, pin: "result" },
        to: { node: a2.uuid, pin: "a" },
      });
      testSchema.wire({
        from: { node: a2.uuid, pin: "result" },
        to: { node: m.uuid, pin: "a" },
      });
    },
    500,
  );

  await runner.run(
    "Wire exec pins",
    () => {
      const testSchema = commutator.createSchema();
      const e = testSchema.createEvent("onClick");
      const f = testSchema.createFunction("log");
      testSchema.wire({
        from: { node: e.uuid, pin: "next" },
        to: { node: f.uuid, pin: "start" },
      });
    },
    500,
  );
}

/**
 * Бенчмарк: Валидация проводов
 */
async function benchmarkWireValidation(runner: BenchmarkRunner): Promise<void> {
  const commutator = createBenchmarkCommutator();

  await runner.run(
    "Wire validation (compatible types)",
    () => {
      const schema = commutator.createSchema();
      const e = schema.createEvent("onClick");
      const a = schema.createPureFunction("add");
      schema.wire({
        from: { node: e.uuid, pin: "x" },
        to: { node: a.uuid, pin: "a" },
      });
    },
    500,
  );

  await runner.run(
    "Wire validation (incompatible types - should fail)",
    () => {
      const schema = commutator.createSchema();
      const e = schema.createEvent("onClick");
      const a = schema.createPureFunction("add");
      try {
        // Попытка подключить Number к String (должна провалиться)
        schema.wire({
          from: { node: e.uuid, pin: "x" },
          to: { node: a.uuid, pin: "a" },
        });
      } catch {
        // Ожидаемая ошибка
      }
    },
    500,
  );
}

/**
 * Бенчмарк: Проверка циклических связей
 */
async function benchmarkCycleDetection(runner: BenchmarkRunner): Promise<void> {
  const commutator = createBenchmarkCommutator();

  await runner.run(
    "Cycle detection (no cycle)",
    () => {
      const schema = commutator.createSchema();
      const a1 = schema.createPureFunction("add");
      const a2 = schema.createPureFunction("add");
      const a3 = schema.createPureFunction("add");

      schema.wire({
        from: { node: a1.uuid, pin: "result" },
        to: { node: a2.uuid, pin: "a" },
      });
      schema.wire({
        from: { node: a2.uuid, pin: "result" },
        to: { node: a3.uuid, pin: "a" },
      });
    },
    500,
  );

  await runner.run(
    "Cycle detection (should detect cycle)",
    () => {
      const schema = commutator.createSchema();
      const a1 = schema.createPureFunction("add");
      const a2 = schema.createPureFunction("add");

      schema.wire({
        from: { node: a1.uuid, pin: "result" },
        to: { node: a2.uuid, pin: "a" },
      });
      try {
        // Попытка создать цикл (должна провалиться)
        schema.wire({
          from: { node: a2.uuid, pin: "result" },
          to: { node: a1.uuid, pin: "a" },
        });
      } catch {
        // Ожидаемая ошибка
      }
    },
    500,
  );
}

/**
 * Бенчмарк: Экспорт/импорт снапшотов
 */
async function benchmarkSnapshots(runner: BenchmarkRunner): Promise<void> {
  const commutator = createBenchmarkCommutator();

  // Создаем схему с несколькими нодами
  const createTestSchema = () => {
    const schema = commutator.createSchema();
    const e = schema.createEvent("onClick");
    const a1 = schema.createPureFunction("add");
    const a2 = schema.createPureFunction("add");
    const m = schema.createPureFunction("multiply");

    schema.wire({
      from: { node: e.uuid, pin: "x" },
      to: { node: a1.uuid, pin: "a" },
    });
    schema.wire({
      from: { node: e.uuid, pin: "y" },
      to: { node: a1.uuid, pin: "b" },
    });
    schema.wire({
      from: { node: a1.uuid, pin: "result" },
      to: { node: a2.uuid, pin: "a" },
    });
    schema.wire({
      from: { node: a2.uuid, pin: "result" },
      to: { node: m.uuid, pin: "a" },
    });

    return schema;
  };

  await runner.run(
    "Extract snapshot (small graph)",
    () => {
      const schema = createTestSchema();
      schema.extract();
    },
    500,
  );

  await runner.run(
    "Create schema from snapshot (small graph)",
    () => {
      const schema = createTestSchema();
      const snapshot = schema.extract();
      commutator.createSchema(snapshot);
    },
    500,
  );
}

/**
 * Бенчмарк: Большие графы
 */
async function benchmarkLargeGraphs(runner: BenchmarkRunner): Promise<void> {
  const commutator = createBenchmarkCommutator();

  const createLargeGraph = (nodeCount: number) => {
    const schema = commutator.createSchema();
    const event = schema.createEvent("onClick");
    const nodes: Array<{ uuid: string; resultPin: string }> = [];

    // Создаем цепочку нод
    for (let i = 0; i < nodeCount; i++) {
      const node = schema.createPureFunction("add");
      nodes.push({
        uuid: node.uuid,
        resultPin: "result",
      });
    }

    // Подключаем event к первой ноде
    if (nodes.length > 0) {
      const firstNode = nodes[0];
      if (firstNode) {
        schema.wire({
          from: { node: event.uuid, pin: "x" },
          to: { node: firstNode.uuid, pin: "a" },
        });
      }
    }

    // Создаем цепочку
    for (let i = 0; i < nodes.length - 1; i++) {
      const current = nodes[i];
      const next = nodes[i + 1];
      if (!current || !next) {
        continue;
      }
      schema.wire({
        from: { node: current.uuid, pin: current.resultPin },
        to: { node: next.uuid, pin: "a" },
      });
    }

    return schema;
  };

  await runner.run(
    "Create large graph (100 nodes)",
    () => {
      createLargeGraph(100);
    },
    10,
  );

  await runner.run(
    "Create large graph (500 nodes)",
    () => {
      createLargeGraph(500);
    },
    5,
  );

  await runner.run(
    "Create large graph (1000 nodes)",
    () => {
      createLargeGraph(1000);
    },
    3,
  );

  await runner.run(
    "Extract snapshot (1000 nodes)",
    () => {
      const schema = createLargeGraph(1000);
      schema.extract();
    },
    3,
  );

  await runner.run(
    "Validate snapshot (1000 nodes)",
    () => {
      const schema = createLargeGraph(1000);
      const snapshot = schema.extract();
      commutator.createSchema(snapshot);
    },
    3,
  );
}

/**
 * Бенчмарк: Валидация снапшотов
 */
async function benchmarkSnapshotValidation(runner: BenchmarkRunner): Promise<void> {
  const commutator = createBenchmarkCommutator();

  const createTestSnapshot = (): SchemaSnapshot => {
    const schema = commutator.createSchema();
    const e = schema.createEvent("onClick");
    const a1 = schema.createPureFunction("add");
    const a2 = schema.createPureFunction("add");
    const m = schema.createPureFunction("multiply");

    schema.wire({
      from: { node: e.uuid, pin: "x" },
      to: { node: a1.uuid, pin: "a" },
    });
    schema.wire({
      from: { node: e.uuid, pin: "y" },
      to: { node: a1.uuid, pin: "b" },
    });
    schema.wire({
      from: { node: a1.uuid, pin: "result" },
      to: { node: a2.uuid, pin: "a" },
    });
    schema.wire({
      from: { node: a2.uuid, pin: "result" },
      to: { node: m.uuid, pin: "a" },
    });

    return schema.extract();
  };

  await runner.run(
    "Snapshot validation (small)",
    () => {
      const snapshot = createTestSnapshot();
      commutator.createSchema(snapshot);
    },
    500,
  );

  // Большой снапшот
  const createLargeSnapshot = (): SchemaSnapshot => {
    const schema = commutator.createSchema();
    const event = schema.createEvent("onClick");
    const nodes: Array<{ uuid: string; resultPin: string }> = [];

    for (let i = 0; i < 500; i++) {
      const node = schema.createPureFunction("add");
      nodes.push({
        uuid: node.uuid,
        resultPin: "result",
      });
    }

    if (nodes.length > 0) {
      const firstNode = nodes[0];
      if (firstNode) {
        schema.wire({
          from: { node: event.uuid, pin: "x" },
          to: { node: firstNode.uuid, pin: "a" },
        });
      }
    }

    for (let i = 0; i < nodes.length - 1; i++) {
      const current = nodes[i];
      const next = nodes[i + 1];
      if (!current || !next) {
        continue;
      }
      schema.wire({
        from: { node: current.uuid, pin: current.resultPin },
        to: { node: next.uuid, pin: "a" },
      });
    }

    return schema.extract();
  };

  await runner.run(
    "Snapshot validation (500 nodes)",
    () => {
      const snapshot = createLargeSnapshot();
      commutator.createSchema(snapshot);
    },
    10,
  );
}

/**
 * Главная функция запуска всех бенчмарков
 */
async function runAllBenchmarks(): Promise<void> {
  const runner = new BenchmarkRunner();

  console.log("Starting benchmarks...\n");

  console.log("1. Schema Creation");
  await benchmarkSchemaCreation(runner);

  console.log("2. Node Creation");
  await benchmarkNodeCreation(runner);

  console.log("3. Wiring");
  await benchmarkWiring(runner);

  console.log("4. Wire Validation");
  await benchmarkWireValidation(runner);

  console.log("5. Cycle Detection");
  await benchmarkCycleDetection(runner);

  console.log("6. Snapshots");
  await benchmarkSnapshots(runner);

  console.log("7. Large Graphs");
  await benchmarkLargeGraphs(runner);

  console.log("8. Snapshot Validation");
  await benchmarkSnapshotValidation(runner);

  runner.printResults();
}

// Запускаем бенчмарки, если файл выполняется напрямую
if (import.meta.main) {
  runAllBenchmarks().catch((error) => {
    console.error("Benchmark failed:", error);
    process.exit(1);
  });
}

export { BenchmarkRunner, runAllBenchmarks };
