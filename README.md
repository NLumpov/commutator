# Commutator

Библиотека для создания визуальных блюпринтов (blueprints) в стиле Unreal Engine Blueprints. Commutator позволяет создавать типобезопасные визуальные графы из нод, которые могут выполнять вычисления, обрабатывать события и управлять потоком выполнения.

[![Storybook shield][shields-storybook-image]](https://storybook.js.org)
[![ESLint shield][shields-eslint-image]](https://eslint.org)
[![ZenVer shield][shields-zenver-image]](https://github.com/NotAShelf/ZenVer)

## Архитектура

Библиотека состоит из трёх основных слоёв:

1. **Commutator** (Коммутатор) — слой настройки типов нод и типов данных блюпринта
2. **CommutatorSchema** (Схема) — слой настройки конкретного блюпринта, связей между нодами и структуры графа
3. **CommutatorInstance** (Инстанс) — слой выполнения, отвечающий за хранение промежуточных состояний, метаданных и запуск блюпринта

## Пакеты

### @commutator/core

Ядро библиотеки Commutator. Содержит основную функциональность и API для создания коммутаторов, схем и работы с нодами.

**Установка:**
```bash
bun add @commutator/core
```

**Базовое использование:**
```typescript
import { Commutator, CommonDataType, PinInstanceType } from "@commutator/core";

// Создание коммутатора с определением типов нод
const commutator = Commutator.initialize()
  .defineEvent("onClick", {
    pinsOut: {
      x: { type: CommonDataType.Number },
      y: { type: CommonDataType.Number },
    },
    execPinsOut: { next: {} },
  })
  .definePureFunction("add", {
    pinsIn: {
      a: { type: CommonDataType.Number },
      b: { type: CommonDataType.Number },
    },
    pinsOut: {
      result: { type: CommonDataType.Number },
    },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
    }),
  });

// Создание схемы (конкретного блюпринта)
const schema = commutator.createSchema();
const event = schema.createEvent("onClick");
const add = schema.createPureFunction("add");

// Создание связей между нодами
const eventPin = schema
  .getNodePins(event.uuid)
  .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
const addPin = schema
  .getNodePins(add.uuid)
  .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

schema.wire({ fromPinUuid: eventPin!.uuid, toPinUuid: addPin!.uuid });
```

### @commutator/flow-control

Расширение с нодами управления потоком выполнения: Branch, Switch, Gate, DoN, DoOnce, FlipFlop и другие.

**Установка:**
```bash
bun add @commutator/flow-control
```

**Использование:**
```typescript
import { Commutator } from "@commutator/core";
import { flowControlExtension } from "@commutator/flow-control";

const commutator = Commutator.initialize()
  .inject(flowControlExtension);

const schema = commutator.createSchema();
const branch = schema.createFunction("Branch");
```

### @commutator/maths

Расширение с математическими функциями: Add, Subtract, Multiply, Divide, Sin, Cos, Tan и другие.

**Установка:**
```bash
bun add @commutator/maths
```

**Использование:**
```typescript
import { Commutator } from "@commutator/core";
import { mathsExtension } from "@commutator/maths";

const commutator = Commutator.initialize()
  .inject(mathsExtension);

const schema = commutator.createSchema();
const add = schema.createPureFunction("Add");
```

## Типы нод

- **Event** — точка входа в блюпринт, триггерится извне
- **PureFunction** — чистая функция без побочных эффектов, вычисляет результат на основе входных данных
- **Function** — функция с побочными эффектами и управлением потоком выполнения
- **Ref** — загрузка внешних сущностей по метаданным

## Типы данных

Библиотека поддерживает базовые типы (`String`, `Number`, `Boolean`, `Date`, `Object`, `Array`, `StringEnum`, `NumberEnum`, `Any`) и позволяет определять пользовательские типы данных.

## Документация

### Exec cycles and execution limits

Configure the budget once on a Commutator instance:

```typescript
const commutator = Commutator.initialize().configure({ maxSteps: 10_000 });
// Define nodes, then create schemas and workers as usual.
await worker.triggerEvent("start", payload);
```

`initialize({ dataTypes, events, refs, pureFunctions, functions, apis })` registers
definitions in bulk with inferred types; each section is optional and `initialize()`
creates an empty registry. Positional arguments and unknown option keys are rejected.
The `create*` methods return node fields and `wire()` on one object:
`node.uuid`, `node.config`, `node.wire("next", otherNode, "in")`.
To change the stored graph, use `schema.moveNode()` and `schema.updateNodeConfig()`.
`configure({ maxSteps })` returns a new instance with the same registry types.
It can be used before or after definitions without changing the original instance
or existing schemas/workers. Definitions retain the limit;
`host.inject(extension)` retains the host's limit, not the extension's.
Options are read at configuration; mutating the supplied options object does not
reconfigure existing schemas or workers. There is no per-trigger override or
process-wide setting.

Exec back edges and exec self-loops are supported by `wire`, `extract`, and schema
restoration. Data cycles and data self-loops remain invalid. With no `maxSteps`,
acyclic graphs retain their existing behavior; attempting to run a graph containing
an exec cycle rejects with `MAX_STEPS_REQUIRED` before changing event caches.
`maxSteps` must be a positive safe integer; invalid configuration throws
`CommutatorExecutionError` with `code: "INVALID_MAX_STEPS"`.

One `triggerEvent` call is one run. Every Function admission, including repeated
visits, reserves one step before reading inputs or invoking a Ref. All matching
Event instances and parallel branches share this counter. Subsequent successful
trigger calls get independent counters under the same configured limit. Concurrent
triggers on one Worker reject with `WORKER_BUSY`. Events, PureFunctions and
Refs do not consume separate steps. Exactly `maxSteps` admissions are allowed;
the next attempt latches `CommutatorExecutionError` with `code: "STEP_LIMIT"`.
Catching that error does not reset the budget. No further Function is admitted.
An admitted input read or yield may still be pending when another branch exhausts
the budget; its user callback is not started after that failure.

`exec` starts traversal immediately and `await exec(...)` waits for the child
branch, including code after its nested awaits. Cyclic graphs periodically yield
to the event loop after capturing direct inputs and meta, before invoking the next
callback. This bounds the synchronous stack and allows timers/process termination;
parallel work may progress during that yield. DAG execution gains no scheduling
queue or yield. Outputs remain one current value per pin UUID, and meta remains
one value per node UUID.

The budget does not limit time inside an arbitrary callback. Already admitted
callbacks and issued `exec` calls are awaited before the trigger settles, including
on failure. Their in-memory outputs remain inaccessible after failure; JavaScript and external
effects cannot be forcibly stopped or rolled back. Callbacks must await their own
asynchronous work. Awaited callback chains retain O(maxSteps) continuations until
completion; this is not constant-memory tail-call execution.

`WorkerSnapshot` contains only independent finite JSON `pinCache` and `metaCache`.
Restore validates the entire snapshot, duplicates, cache ownership and value types
without executing callbacks. Snapshots do not contain graph identity or versions;
the library does not detect graph changes. The caller must discard saved snapshots
and existing Workers when the graph or its definitions change, then create a fresh
Worker without a snapshot. Schema remains mutable through its existing APIs.

```ts
const baseline = schema.createWorker().extract();
const worker = schema.createWorker(baseline);
await worker.triggerEvent("start", input);
const next = worker.extract(); // persist only after the entire trigger succeeds
```

Restore, trigger input, and extraction separate nested caller data from Worker
caches. Trigger input is checked before callbacks, while shared values and object
key order are preserved inside a run. Non-JSON input/snapshot values (including
undefined, non-finite numbers, functions, promises, cycles, accessors, custom
objects and Array subclasses) are rejected rather than silently converted.
Ordinary arrays and plain or null-prototype records are supported. Explicit
undefined Function outputs or metadata updates are rejected; an omitted update
retains the old value and null is a value. Invalid JSON produced internally through
an Any field is also rejected at extract. `extract()` during execution rejects with `WORKER_BUSY`.
After a trigger fails and all issued child exec calls drain, both trigger and
extract reject with `WORKER_FAILED`; create a new Worker from the last baseline.
Calling a retained exec after its callback context closes rejects with
`EXEC_CONTEXT_CLOSED` without changing caches.

A crash in `A → await exec(B) → tail` requires replaying the entire trigger from
the baseline; previously persisted triggers are retained. Snapshots do not contain
the JS stack, spent crash-attempt steps, race schedules, or call history. The host
owns atomic persistence, retry limits, durable operation IDs, idempotency, receipts,
unknown-outcome reconciliation, and stale-owner protection. The test-only
`flow-consumer.test.ts` and `fixtures/flow-consumer.ts` demonstrate these boundaries:
a lost response with unavailable or inconclusive lookup enters unknown outcome
automatically, blocking launch/commit until an authoritative receipt reconciles it.
A reliable same-key provider dedupe permits retry without another agent.
The library adds no Agents
or Flow runtime. Ordinary fan-in executes once per incoming branch, not as Join.

See [the development/review cycle example](packages/examples/17-exec-cycles.ts).

Подробная документация для разработчиков и AI агентов находится в файле [AGENTS.MD](./AGENTS.MD).

## Разработка

### Установка зависимостей

```bash
bun install
```

### Запуск тестов

```bash
bun test
```

### Создание нового расширения

1. Создайте новую папку в `packages/`:
   ```bash
   mkdir -p packages/your-extension
   ```

2. Создайте `package.json`:
   ```json
   {
     "name": "@commutator/your-extension",
     "version": "0.1.0",
     "type": "module",
     "main": "./index.ts",
     "module": "./index.ts",
     "types": "./index.ts",
     "dependencies": {
       "@commutator/core": "workspace:*"
     },
     "peerDependencies": {
       "typescript": "^5"
     }
   }
   ```

3. Создайте `tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@commutator/core": ["../core/index.ts"]
       }
     },
     "include": ["./**/*"]
   }
   ```

4. Создайте `index.ts` с вашим расширением:
   ```typescript
   import { Commutator, CommonDataType } from "@commutator/core";

   export const yourExtension = Commutator.initialize()
     .defineFunction("yourFunction", {
       // конфигурация ноды
     });
   ```

### Работа с workspaces

Все пакеты автоматически связаны через Bun workspaces. Вы можете импортировать пакеты друг в друга используя `workspace:*` в зависимостях.

## Требования

- Bun (вместо Node.js, npm, pnpm или vite)
- TypeScript ^5

[shields-storybook-image]: https://img.shields.io/badge/кул_стори-братан-white?logo=storybook&color=FF4785&style=flat-square
[shields-zenver-image]: https://img.shields.io/badge/писать_версии-впадлу-white?logo=kfc&color=F40027&style=flat-square
[shields-eslint-image]: https://img.shields.io/badge/еслинта-нет-white?logo=eslint&color=6358D4&style=flat-square
