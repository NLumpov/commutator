const equal = (actual: unknown, expected: unknown): void => {
  if (actual !== expected) throw new Error(`Mismatch: ${String(actual)} !== ${String(expected)}`);
};

import { heapStats } from "bun:jsc";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const [variant = "", mode = "", caseName = "", countText = "", outputPath = ""] =
  process.argv.slice(2);
if (!["baseline", "candidate"].includes(variant)) throw new Error("Unknown version");
const root = process.env.COM0008_DATA_DIR ?? import.meta.dir;
const locations = JSON.parse(await readFile(`${root}/sources.json`, "utf8"));
const { Commutator, CommonDataType: T } = await import(
  `${locations[variant]}/packages/core/index.ts`
);
const cases = [
  "empty-32",
  "number-32",
  "wide-32x8",
  "nested-128x8",
  "event-32",
  "pure-16",
  "unawaited-16",
];
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function fixture(name: string) {
  let calls = 0,
    sum = 0;
  let expectedCalls = 1,
    expectedSum = 0;
  let c = Commutator.initialize();
  c = c.configure({ maxSteps: 10_000 });
  let payload: any = {};
  let build: (schema: any) => void;
  if (name === "unawaited-16") {
    expectedCalls = 16;
    expectedSum = 120;
    c = c
      .defineEvent("Tick", { pinsOut: {}, execPinsOut: { next: null } })
      .defineFunction("Emit", {
        pinsIn: {},
        pinsOut: { value: { type: T.Number } },
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        exec: async ({ exec }: any) => {
          for (let i = 0; i < 16; i++)
            void exec({ pinsOut: { value: i }, execPinOut: "next", meta: null });
        },
      })
      .defineFunction("Sink", {
        pinsIn: { value: { type: T.Number } },
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: {},
        exec: async ({ pinsIn }: any) => {
          calls++;
          sum += pinsIn.value;
        },
      });
    build = (s) => {
      const source = s.createFunction("Emit"),
        sink = s.createFunction("Sink");
      s.createEvent("Tick").wire("next", source, "start");
      source.wire("next", sink, "start").wire("value", sink, "value");
    };
  } else {
    const empty = name === "empty-32";
    const wide = name === "wide-32x8" || name === "event-32";
    const nested = name === "nested-128x8";
    const pure = name === "pure-16";
    const depth = name === "event-32" ? 0 : wide || nested ? 8 : pure ? 16 : 32;
    const fields: any = empty
      ? {}
      : wide
        ? Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`v${i}`, { type: T.Number }]))
        : nested
          ? {
              value: {
                type: T.Object,
                properties: {
                  values: { type: T.Array, itemType: { type: T.Number } },
                  label: { type: T.String },
                },
              },
            }
          : { value: { type: T.Number } };
    payload = empty
      ? {}
      : wide
        ? Object.fromEntries(Object.keys(fields).map((k) => [k, 0]))
        : nested
          ? { value: { values: Array.from({ length: 128 }, (_, i) => i), label: "payload" } }
          : { value: 0 };
    expectedSum = empty ? 0 : nested ? 127 : depth;
    const inputs = Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [`in_${key}`, field]),
    );
    const transform = (input: any) =>
      empty
        ? {}
        : wide
          ? Object.fromEntries(Object.keys(fields).map((k) => [k, input[`in_${k}`] + 1]))
          : nested
            ? { value: input.in_value }
            : { value: input.in_value + 1 };
    c = c.defineEvent("Tick", { pinsOut: fields, execPinsOut: { next: null } });
    c = pure
      ? c.definePureFunction("Step", {
          pinsIn: inputs,
          pinsOut: fields,
          exec: async ({ pinsIn }: any) => transform(pinsIn),
        })
      : c.defineFunction("Step", {
          pinsIn: inputs,
          pinsOut: fields,
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }: any) =>
            exec({ pinsOut: transform(pinsIn), execPinOut: "next", meta: null }),
        });
    c = c.defineFunction("Sink", {
      pinsIn: inputs,
      pinsOut: {},
      execPinsIn: { start: null },
      execPinsOut: {},
      exec: async ({ pinsIn }: any) => {
        calls++;
        sum += empty
          ? 0
          : wide
            ? pinsIn.in_v0
            : nested
              ? pinsIn.in_value.values[127]
              : pinsIn.in_value;
      },
    });
    build = (s) => {
      const event = s.createEvent("Tick"),
        sink = s.createFunction("Sink");
      let prev = event;
      for (let i = 0; i < depth; i++) {
        const step = pure ? s.createPureFunction("Step") : s.createFunction("Step");
        if (!pure) prev.wire("next", step, "start");
        for (const key of Object.keys(fields)) prev.wire(key, step, `in_${key}`);
        prev = step;
      }
      (pure ? event : prev).wire("next", sink, "start");
      for (const key of Object.keys(fields)) prev.wire(key, sink, `in_${key}`);
    };
  }
  return {
    c,
    payload,
    build,
    check: (triggers: number) => {
      equal(calls, triggers * expectedCalls);
      equal(sum, triggers * expectedSum);
    },
    reset: () => {
      calls = 0;
      sum = 0;
    },
  };
}

async function load(name: string) {
  const f = fixture(name);
  const snapshot = JSON.parse(await readFile(`${root}/schemas/${name}.json`, "utf8"));
  const schema = f.c.createSchema(snapshot);
  equal(digest(schema.extract()), digest(snapshot));
  return { ...f, schema, worker: schema.createWorker(), schemaHash: digest(snapshot) };
}

if (mode === "prepare") {
  await mkdir(`${root}/schemas`, { recursive: true });
  for (const name of cases) {
    const f = fixture(name),
      schema = f.c.createSchema();
    f.build(schema);
    await writeFile(`${root}/schemas/${name}.json`, JSON.stringify(schema.extract()));
  }
  console.log(JSON.stringify({ schemas: cases }));
} else if (mode === "measure") {
  const f = await load(caseName);
  const count = Number(countText);
  const warmup = Math.max(2000, Math.min(count, 15000));
  for (let i = 0; i < warmup; i++) await f.worker.triggerEvent("Tick", f.payload);
  f.check(warmup);
  f.reset();
  // No forced GC, clocks or sample collection inside the operation loop.
  const samples = [];
  for (let sample = 0; sample < 7; sample++) {
    const start = performance.now();
    for (let i = 0; i < count; i++) await f.worker.triggerEvent("Tick", f.payload);
    samples.push(((performance.now() - start) * 1000) / count);
    f.check(count);
    f.reset();
  }
  const result = {
    variant,
    case: caseName,
    count,
    warmup,
    samplesUs: samples,
    schemaHash: f.schemaHash,
    workerHash: digest({
      pinCache: f.worker.extract().pinCache,
      metaCache: f.worker.extract().metaCache,
    }),
    snapshotBytes: Buffer.byteLength(JSON.stringify(f.worker.extract())),
    memory: process.memoryUsage(),
    resourceUsage: process.resourceUsage(),
  };
  if (outputPath) await writeFile(outputPath, JSON.stringify(result));
  console.log(JSON.stringify(result));
} else if (["extract", "restore", "checkpoint"].includes(mode)) {
  const f = await load(caseName);
  await f.worker.triggerEvent("Tick", f.payload);
  f.check(1);
  f.reset();
  const snapshot = f.worker.extract();
  const count = Number(countText);
  const warmup = Math.max(20, Math.min(count, 300));
  let sink: any;
  const operation =
    mode === "extract"
      ? () => {
          sink = f.worker.extract();
        }
      : mode === "restore"
        ? () => {
            sink = f.schema.createWorker(snapshot);
          }
        : async () => {
            const w = f.schema.createWorker(snapshot);
            await w.triggerEvent("Tick", f.payload);
            sink = w.extract();
          };
  for (let i = 0; i < warmup; i++) await operation();
  if (mode === "checkpoint") {
    f.check(warmup);
    f.reset();
  }
  const samples = [];
  for (let sample = 0; sample < 7; sample++) {
    const start = performance.now();
    for (let i = 0; i < count; i++) await operation();
    samples.push(((performance.now() - start) * 1000) / count);
    if (mode === "checkpoint") {
      f.check(count);
      f.reset();
    }
  }
  const actual = mode === "restore" ? sink.extract() : sink;
  equal(digest(actual.pinCache), digest(snapshot.pinCache));
  equal(digest(actual.metaCache), digest(snapshot.metaCache));
  const result = {
    variant,
    mode,
    case: caseName,
    count,
    warmup,
    samplesUs: samples,
    schemaHash: f.schemaHash,
    workerHash: digest({ pinCache: actual.pinCache, metaCache: actual.metaCache }),
    snapshotBytes: Buffer.byteLength(JSON.stringify(actual)),
    memory: process.memoryUsage(),
    resourceUsage: process.resourceUsage(),
  };
  if (outputPath) await writeFile(outputPath, JSON.stringify(result));
  console.log(JSON.stringify(result));
} else if (mode === "memory" || mode === "snapshot-memory") {
  const f = await load(caseName);
  const count = Number(countText);
  const samples = [];
  await f.worker.triggerEvent("Tick", f.payload);
  f.check(1);
  f.reset();
  const baseline = f.worker.extract();
  const operation =
    mode === "memory"
      ? () => f.worker.triggerEvent("Tick", f.payload)
      : async () => {
          const w = f.schema.createWorker(baseline);
          await w.triggerEvent("Tick", f.payload);
          w.extract();
        };
  const sample = async (epoch: number) => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    Bun.gc(true);
    const h = heapStats(),
      m = process.memoryUsage();
    samples.push({
      epoch,
      heapSize: h.heapSize,
      heapCapacity: h.heapCapacity,
      objects: h.objectCount,
      promises: h.objectTypeCounts.Promise ?? 0,
      rss: m.rss,
    });
  };
  for (let i = 0; i < count; i++) await operation();
  f.check(count);
  f.reset();
  await sample(0);
  for (let epoch = 1; epoch <= 12; epoch++) {
    for (let i = 0; i < count; i++) await operation();
    f.check(count);
    f.reset();
    await sample(epoch);
  }
  const result = {
    variant,
    case: caseName,
    count,
    samples,
    schemaHash: f.schemaHash,
    workerHash: digest({
      pinCache: f.worker.extract().pinCache,
      metaCache: f.worker.extract().metaCache,
    }),
  };
  if (outputPath) await writeFile(outputPath, JSON.stringify(result));
  console.log(JSON.stringify(result));
} else throw new Error(`Unknown mode ${mode}`);
