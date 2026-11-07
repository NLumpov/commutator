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

schema.wire(eventPin.uuid, addPin.uuid);
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

`initialize(dataTypes, events, refs, pureFunctions, functions, apis)` keeps its
existing positional arguments and type inference; `initialize()` remains valid.
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
trigger calls get independent counters under the same configured limit; their
pin/meta caches retain the existing shared behavior. A concurrent call on the
same Worker rejects with `WORKER_BUSY` without affecting the active call. Events, PureFunctions and
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
on failure. Their committed outputs remain; arbitrary JavaScript and external
effects cannot be forcibly stopped or rolled back. Callbacks must await their own
asynchronous work. Awaited callback chains retain O(maxSteps) continuations until
completion; this is not constant-memory tail-call execution.

`WorkerSnapshot` contains independent finite JSON `pinCache`/`metaCache` arrays
and a `schemaFingerprint`. `extract()` is available between successful triggers;
while a trigger or its children/tails are active it rejects with `WORKER_BUSY`.
A failed trigger drains its issued children before rejecting with its original
error. The failed instance then rejects trigger/extract with `WORKER_FAILED`.
Late `exec` calls after the callback and its children have settled reject with
`EXEC_CLOSED` before changing caches. Detached external work must be awaited by
the callback; Worker cannot cancel arbitrary background IO.

`createWorker(snapshot)` validates the entire format, finite JSON, cache identities
and types before installing either cache. Invalid values/format reject with
`INVALID_JSON`/`INVALID_SNAPSHOT`; another graph rejects with `SCHEMA_MISMATCH`.
There is no reader for the old fingerprint-free format. Extract also validates
cache types, including objects mutated in place by callbacks. Snapshot restore,
trigger input and extraction detach nested JSON at API boundaries; values remain
shared by pin UUID inside a trigger, with no clone on each Function visit.

The SHA-256 fingerprint covers the canonical SchemaSnapshot with sorted object
keys and original array order (including roots, pins and wires). It observes
live schema edits, including nested edits through public schema objects. It does
not identify JS definitions, limits or client bindings: consumers must pin those
independently. Do not edit the schema during a replayable trigger.

A consumer can save a baseline, persist its pending event/input and replay the
whole failed trigger in a new Worker. `A -> await exec(B) -> tail A` replays A,
B and the tail; a completed child is not a durable checkpoint. Previously saved
successful triggers are not replayed. The consumer must persist a stable external
operation ID before RPC and reconcile lost responses, and atomically commit the
next snapshot with command completion/next work. Worker never retries a trigger
or rolls back external effects. `maxSteps` covers one attempt; lost in-memory
steps are not restored. The consumer separately bounds attempts and treats
`STEP_LIMIT` as terminal. Human waits, persistent receipts/leases, completion
deduplication and stop/reconciliation remain consumer responsibilities.
Ordinary fan-in still executes once per incoming branch, not as a Join barrier;
repeated Join generations are a separate feature.

```typescript
const baseline = worker.extract(); // Already saved before dispatch.
const attempt = pinnedSchema.createWorker(baseline);
await attempt.triggerEvent(command.event, command.input);
const next = attempt.extract();
// Consumer atomically commits next + command receipt + next work.
// On failure, discard attempt and reconcile effects before replay from baseline.
```

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
