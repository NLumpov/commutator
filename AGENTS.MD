# Commutator - Документация для AI агентов

## Обзор

**Commutator** — это библиотека для создания визуальных блюпринтов (blueprints) в стиле Unreal Engine Blueprints. Библиотека позволяет создавать визуальные графы из нод, которые могут выполнять вычисления, обрабатывать события и управлять потоком выполнения.

Библиотека состоит из трёх основных слоёв:

1. **Commutator** (Коммутатор) — слой настройки типов нод и типов данных блюпринта
2. **CommutatorSchema** (Схема) — слой настройки конкретного блюпринта, связей между нодами и структуры графа
3. **CommutatorWorker** (Воркер) — слой выполнения, отвечающий за запуск блюпринта, кеширование промежуточных состояний и метаданных

## Архитектура

### Слой 1: Commutator (Коммутатор)

**Назначение:** Определение типов данных, типов нод и их конфигураций.

**Основные компоненты:**

- **DataTypes** — пользовательские типы данных (расширяют базовые типы)
- **Events** — типы событийных нод
- **Refs** — типы референсных нод (для загрузки внешних сущностей)
- **PureFunctions** — типы чистых функций (без побочных эффектов)
- **Functions** — типы функций с побочными эффектами и управлением потоком
- **Apis** — API для работы с внешними системами

**Ключевые методы:**

```typescript
Commutator.initialize() // Прежние позиционные аргументы dataTypes/events/refs/pureFunctions/functions/apis
.configure({ maxSteps: 10_000 }) // Общий лимит каждого запуска; для DAG настройка необязательна
.defineDataType(name, field) // Определение пользовательского типа данных
.defineEvent(name, config) // Определение типа события
.defineRef(name, config) // Определение типа референса
.definePureFunction(name, config) // Определение чистой функции
.defineFunction(name, config) // Определение функции
.defineApi(name, api) // Определение API для внешних систем
.inject(otherCommutator) // Инъекция другого коммутатора (расширение)
.createSchema(snapshot?) // Создание схемы из коммутатора
```

**Пример:**

```typescript
const commutator = Commutator.initialize()
  .defineDataType("User", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      name: { type: CommonDataType.String },
    },
  })
  .defineEvent("onClick", {
    pinsOut: {
      x: { type: CommonDataType.Number },
      y: { type: CommonDataType.Number },
    },
    execPinsOut: {
      next: {},
    },
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
  });
```

### Слой 2: CommutatorSchema (Схема)

**Назначение:** Создание конкретного экземпляра блюпринта, управление нодами, пинами и связями между ними.

**Основные компоненты:**

- **Node Instances** — экземпляры нод в графе (Event, Ref, PureFunction, Function)
- **Pin Instances** — экземпляры пинов (входные/выходные, data/exec)
- **Wires** — связи между пинами

**Ключевые методы:**

```typescript
// Создание нод (возвращают FluentNodeBuilder)
.createEvent(name, config?) // Создание экземпляра события
.createRef(name, config?) // Создание экземпляра референса
.createPureFunction(name, config?) // Создание экземпляра чистой функции
.createFunction(name, config?) // Создание экземпляра функции

// Работа с проводами
.wire({ from: { node, pin }, to: { node, pin } }) // Создание связи (именованные параметры)
.wire({ fromPinUuid, toPinUuid }) // Создание связи (по UUID пинов)
.unwire({ from: { node, pin }, to: { node, pin } }) // Удаление связи

// Работа с пинами
.getPin(nodeUuid, pinName) // Получение пина по имени
.getNodePins(nodeUuid) // Получение всех пинов ноды
.addPinIn(nodeUuid) // Добавление входного data-пина (через callback)
.addPinOut(nodeUuid) // Добавление выходного data-пина (через callback)
.addExecPinIn(nodeUuid) // Добавление входного exec-пина (через callback)
.addExecPinOut(nodeUuid) // Добавление выходного exec-пина (через callback)
.removePin(pinUuid) // Удаление пина
.updatePin(pinUuid, { name?, dataType? }) // Обновление пина
.setPinDefaultValue(pinUuid, value) // Установка значения по умолчанию

// Работа с нодами
.moveNode(nodeUuid, x, y) // Перемещение ноды
.updateNodeConfig(nodeUuid, config) // Обновление конфигурации ноды

// Снапшоты и воркер
.extract() // Экспорт схемы в снапшот
.createWorker(snapshot?) // Создание воркера для выполнения
```

**Правила валидации:**

1. **Типы данных:** При создании связи между data-пинами проверяется глубокая совместимость типов (включая вложенные Object, Array, Enum)
2. **Циклические связи:** Data-циклы запрещены; exec-циклы разрешены и требуют конечного `maxSteps` при запуске
3. **Self-loop:** Data self-loop и связь пина с самим собой запрещены; OutputExec -> InputExec одной Function разрешён
4. **Уникальность входов:** Data-пин на входе может иметь только одну входящую связь
5. **OutputExec ограничение:** OutputExec-пин может иметь только один исходящий провод
6. **Динамические пины:** Можно добавлять/удалять пины только если определены соответствующие callback'и (`addPinIn`, `addPinOut`, `addExecPinIn`, `addExecPinOut`)

**Пример:**

```typescript
const schema = commutator.createSchema();

// Создание нод с Fluent API
const event = schema.createEvent("onClick");
const add = schema.createPureFunction("add");
const log = schema.createFunction("log");

// Подключение через Fluent API
event.wire("x", add, "a").wire("next", log, "");

// Или через именованные параметры
schema.wire({
  from: { node: event.uuid, pin: "y" },
  to: { node: add.uuid, pin: "b" },
});

// Создание воркера для выполнения
const worker = schema.createWorker();
await worker.triggerEvent("onClick", { x: 10, y: 20 });
```

### Слой 3: CommutatorWorker (Воркер)

**Назначение:** Выполнение блюпринта, кеширование промежуточных состояний и метаданных.

**Ключевые методы:**

```typescript
.triggerEvent(name, payload) // Запуск события с payload
.extract() // Экспорт состояния воркера в снапшот
```

**Стратегии выполнения:**

1. **Push-стратегия** — для Functions: выполнение происходит при триггере входного exec-пина, затем управление передаётся по выходному exec-пину
2. **Pull-стратегия** — для PureFunctions и Refs: вычисление происходит по требованию, когда Function запрашивает значение входного пина

**Кеширование:**

Воркер использует два уровня кеширования:

1. **Persistent Cache (`pinCache`)** — постоянный кеш для Events и Functions:
   - Значения сохраняются между вызовами
   - Events: кешируют payload после триггера
   - Functions: кешируют выходные значения после выполнения

2. **Runtime Cache (`runtimePinCache`)** — временный кеш для одного выполнения:
   - PureFunctions: кешируют результаты в рамках одного triggerEvent
   - Refs: кешируют загруженные данные в рамках одного triggerEvent

3. **Meta Cache (`metaCache`)** — кеш метаданных нод:
   - Хранит состояние между вызовами (счётчики, флаги и т.д.)
   - Обновляется через `exec({ meta: newValue })`

**Порядок выполнения:**

1. `triggerEvent` находит все ноды события по имени
2. Сохраняет payload в `pinCache` для пинов события
3. Добавляет подключённые Function-ноды в очередь выполнения
4. Последовательно обрабатывает очередь:
   - Для каждой Function собирает входные значения
   - Если входной пин подключён к PureFunction/Ref — вычисляет их (pull-стратегия)
   - Выполняет функцию и кеширует результаты
   - `exec` немедленно начинает дочернюю ветку; `await exec` ждёт её завершения

`initialize(dataTypes, events, refs, pureFunctions, functions, apis)` сохраняет
прежние позиционные аргументы и типовывод. `.configure({ maxSteps })` возвращает
новый экземпляр того же generic-типа, не меняя исходный экземпляр или уже созданные
schemas/workers. Все `define` сохраняют настройку; `host.inject(extension)` сохраняет
лимит host. `triggerEvent(name, payload)` не принимает переопределение лимита.

Один trigger — один счётчик для всех его Event instances и параллельных ветвей.
Каждый вход в Function резервирует шаг до чтения входов. Ровно `maxSteps` входов
допустимы, следующий фиксирует `STEP_LIMIT`; перехват ошибки не сбрасывает бюджет.
Конкурентные trigger имеют независимые счётчики и прежние общие pin/meta cache.
Без настроенного положительного safe integer цикл отклоняется с `MAX_STEPS_REQUIRED`;
невалидный заданный лимит — `INVALID_MAX_STEPS` при конфигурации.

В циклическом графе Worker периодически уступает event loop после чтения прямых
входов/meta, до callback, чтобы ограничить JS stack. У DAG дополнительной очереди
или yield нет. `await exec` и код после него сохраняют порядок; его продолжения
занимают O(maxSteps) памяти до завершения. Уже допущенные callback и вызовы exec
дожидаются завершения даже при ошибке. Лимит не отменяет произвольный JS или внешние
эффекты и не ограничивает время callback. Callback должен ожидать свою async-работу.

**Пример:**

```typescript
// Создание воркера из схемы
const worker = schema.createWorker();

// Запуск события
await worker.triggerEvent("onClick", { x: 100, y: 200 });

// Сохранение состояния
const workerSnapshot = worker.extract();

// Восстановление состояния
const restoredWorker = schema.createWorker(workerSnapshot);
```

## Типы нод

### Event (Событие)

**Назначение:** Точка входа в блюпринт, триггерится извне через `worker.triggerEvent()`.

**Характеристики:**

- Имеет только выходные пины (`pinsOut`, `execPinsOut`)
- Не имеет входных пинов
- Используется для инициирования выполнения графа
- **Кеширует данные в Persistent Cache** — значения payload сохраняются и используются до следующего триггера

**Пример:**

```typescript
.defineEvent("onClick", {
  pinsOut: {
    x: { type: CommonDataType.Number },
    y: { type: CommonDataType.Number },
  },
  execPinsOut: {
    next: {},
  },
  config: { type: CommonDataType.String }, // Опциональная конфигурация
  onConfigChange: ({ config, actions }) => {
    // Реакция на изменение конфигурации
  },
})
```

### PureFunction (Чистая функция)

**Назначение:** Функция без побочных эффектов, вычисляет результат на основе входных данных.

**Характеристики:**

- Имеет входные и выходные data-пины
- Не имеет exec-пинов
- Выполняется по pull-стратегии (когда требуется значение)
- **Кеширует результаты в Runtime Cache** — вычисляется один раз за triggerEvent

**Пример:**

```typescript
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
  // Опционально: динамические пины
  addPinIn: ({ actions }) => {
    actions.addPin("c", PinInstanceType.Input, { type: CommonDataType.Number });
  },
})
```

### Function (Функция)

**Назначение:** Функция с побочными эффектами и управлением потоком выполнения.

**Характеристики:**

- Имеет входные и выходные data-пины
- Имеет входные и выходные exec-пины
- Выполняется по push-стратегии (при триггере exec-пина)
- Может иметь метаданные (`meta`) для хранения состояния между вызовами
- **Кеширует данные в Persistent Cache** — выходные значения сохраняются между вызовами

**Пример:**

```typescript
.defineFunction("counter", {
  pinsIn: {
    step: { type: CommonDataType.Number },
  },
  pinsOut: {
    value: { type: CommonDataType.Number },
  },
  execPinsIn: {
    increment: {},
    reset: {},
  },
  execPinsOut: {
    next: {},
  },
  meta: { type: CommonDataType.Number }, // Состояние счётчика
  exec: async ({ pinsIn, meta, triggeredExecPinKey, exec }) => {
    let newValue = meta ?? 0;

    if (triggeredExecPinKey === "increment") {
      newValue += pinsIn.step ?? 1;
    } else if (triggeredExecPinKey === "reset") {
      newValue = 0;
    }

    await exec({
      execPinOut: "next",
      pinsOut: { value: newValue },
      meta: newValue,
    });
  },
})
```

### Ref (Референс)

**Назначение:** Загрузка внешних сущностей по конфигурации.

**Характеристики:**

- Имеет выходные пины (`pinsOut`)
- Использует `resolveRef` для загрузки данных
- Имеет доступ к API для работы с внешними системами
- **Кеширует данные в Runtime Cache** — загружается один раз за triggerEvent

**Пример:**

```typescript
.defineRef("userRef", {
  pinsOut: {
    user: { type: "User" }, // Пользовательский тип
  },
  config: {
    type: CommonDataType.Object,
    properties: {
      userId: { type: CommonDataType.String },
    },
  },
  resolveRef: async ({ config, api }) => {
    const user = await api.userService.getById(config.userId);
    return { user };
  },
})
```

## Типы данных

### Базовые типы (CommonDataType)

- `Any` — любой тип (принимает все типы при валидации, но не может быть источником для других типов кроме Any)
- `String` — строка
- `Number` — число
- `Boolean` — булево значение
- `Date` — дата (хранится как число timestamp)
- `Object` — объект с определёнными свойствами
- `Array` — массив с определённым типом элементов
- `StringEnum` — перечисление строковых значений
- `NumberEnum` — перечисление числовых значений

### Пользовательские типы

Можно определять собственные типы данных через `defineDataType`:

```typescript
.defineDataType("User", {
  type: CommonDataType.Object,
  properties: {
    id: { type: CommonDataType.String },
    name: { type: CommonDataType.String },
    age: { type: CommonDataType.Number },
  },
})
```

### Значения по умолчанию

Каждый тип имеет значение по умолчанию, которое генерируется автоматически:

- `String` → `""`
- `Number` / `Date` → `0`
- `Boolean` → `false`
- `Array` → `[]`
- `Object` → объект со значениями по умолчанию для каждого свойства
- `StringEnum` / `NumberEnum` → первое значение из списка
- `Any` → `null`

Можно переопределить через свойство `default` в определении поля:

```typescript
pinsIn: {
  value: { type: CommonDataType.Number, default: 100 },
}
```

## Пины (Pins)

### Типы пинов (PinInstanceType)

1. **Input** — входной data-пин для получения данных
2. **Output** — выходной data-пин для передачи данных
3. **InputExec** — входной exec-пин для получения сигнала выполнения
4. **OutputExec** — выходной exec-пин для передачи сигнала выполнения

### Структура PinInstance

```typescript
interface PinInstance {
  readonly nodeUuid: string; // UUID родительской ноды
  readonly uuid: string; // Уникальный идентификатор пина
  readonly type: PinInstanceType; // Тип пина
  default?: unknown; // Значение по умолчанию (только для Input)
  name: string; // Имя пина
  dataType: Field | null; // Тип данных (null для exec-пинов)
}
```

### Правила работы с пинами

1. **Input** пин может иметь только одну входящую связь
2. **InputExec** пины могут иметь множественные входящие связи
3. **OutputExec** пин может иметь только одну исходящую связь
4. При создании связи проверяется глубокая совместимость типов
5. Пины можно добавлять/удалять только если определены callback'и `addPinIn/Out` или `addExecPinIn/Out`
6. Нельзя удалить последний пин данного типа в ноде

## Связи (Wires)

**Назначение:** Соединение пинов для передачи данных и управления потоком.

**Структура Wire:**

```typescript
interface Wire {
  from: string; // UUID выходного пина
  to: string; // UUID входного пина
}
```

**Правила:**

1. Связь создаётся только между Output → Input или OutputExec → InputExec
2. Запрещены data-циклы; exec-циклы разрешены
3. Запрещены data self-loop и связь пина с самим собой; exec self-loop разрешён
4. Метод `unwire` работает идемпотентно

**Примеры использования wire:**

```typescript
// 1. Через именованные параметры
schema.wire({
  from: { node: event.uuid, pin: "x" },
  to: { node: add.uuid, pin: "a" },
});

// 2. Через UUID пинов
schema.wire({
  fromPinUuid: xPin.uuid,
  toPinUuid: aPin.uuid,
});

// 3. Через Fluent API
event.wire("x", add, "a");
```

## Node Callbacks

Ноды могут реагировать на изменения через callback'и:

### onConfigChange

Вызывается при создании ноды и при изменении её конфигурации через `updateNodeConfig`:

```typescript
.defineEvent("dynamicEvent", {
  config: {
    type: CommonDataType.Object,
    properties: {
      outputCount: { type: CommonDataType.Number },
    },
  },
  pinsOut: {},
  execPinsOut: {},
  onConfigChange: ({ config, actions }) => {
    // Сбросить пины до начального состояния
    actions.resetPins();

    // Добавить динамические пины на основе конфигурации
    for (let i = 0; i < (config?.outputCount ?? 0); i++) {
      actions.addPin(`output_${i}`, PinInstanceType.Output, {
        type: CommonDataType.String,
      });
    }
  },
})
```

### NodeCallbackActions

Объект `actions` предоставляет методы для манипуляции пинами:

```typescript
interface NodeCallbackActions {
  // Добавление пинов
  addPin(name: string, type: Input | Output, dataType: Field): void;
  addExecPin(name: string, type: InputExec | OutputExec): void;

  // Изменение пинов
  updatePin(pinUuid: string, args: { name?: string; dataType?: Field }): void;
  removePin(pinUuid: string): void;
  resetPins(): void; // Сброс к начальному состоянию из конфигурации

  // Получение информации
  getPin(name: string): PinInstance | undefined;
  getAllPins(): PinInstance[];
  isWired(name: string): boolean;
  getWiredNode(name: string): PinInstance | undefined;
  getPinConfig(name: string): Field | undefined;
}
```

## Снапшоты (Snapshots)

### SchemaSnapshot

Сериализуемое представление схемы:

```typescript
interface SchemaSnapshot {
  nodes: AbstractNodeInstance[]; // Все ноды
  pinInstances: PinInstance[]; // Все пины
  wires: Wire[]; // Все связи
}
```

### WorkerSnapshot

Сериализуемое представление состояния воркера:

```typescript
interface WorkerSnapshot {
  schemaFingerprint: string; // Canonical graph SHA-256; semantic array order is preserved
  pinCache: { uuid: string; cache: any }[]; // Кеш значений пинов
  metaCache: { uuid: string; cache: any }[]; // Кеш метаданных нод
}
```

This is an independent finite JSON boundary between complete successful triggers,
not a saved JS stack. Restore validates the entire format, graph fingerprint and
cache types. Trigger input and restored/extracted snapshots never alias caller JSON.
One trigger per Worker: concurrent trigger/extract rejects WORKER_BUSY without
poisoning the active call. Own failure drains children, then future trigger/extract
rejects WORKER_FAILED. Recreate from the saved baseline to replay the entire event,
including nested exec and parent tails; never resume a child in isolation. Late
exec after callback completion and drain rejects EXEC_CLOSED before mutation.
Counter, Promise, waits and continuations are not saved. maxSteps starts anew for
each attempt; consumers bound attempts separately and reconcile external operations
by stable operationId. The fingerprint identifies graph JSON, not JS definitions
or service clients; consumers pin them. Durable receipts/leases/stop and repeated
Join generations remain outside Worker. Ordinary fan-in is not Join.

**Использование:**

```typescript
// Экспорт схемы
const schemaSnapshot = schema.extract();

// Восстановление схемы
const restoredSchema = commutator.createSchema(schemaSnapshot);

// Экспорт состояния воркера
const workerSnapshot = worker.extract();

// Восстановление воркера с состоянием
const restoredWorker = restoredSchema.createWorker(workerSnapshot);
```

## Fluent API

### FluentNodeBuilder

Методы `createEvent`, `createRef`, `createPureFunction`, `createFunction` возвращают `FluentNodeBuilder`, который:

1. Реализует интерфейс `AbstractNodeInstance` для обратной совместимости
2. Предоставляет метод `wire` для цепочечного подключения пинов

```typescript
// Создание и подключение в одной цепочке
const event = schema
  .createEvent("onClick")
  .wire("x", addNode, "a")
  .wire("y", addNode, "b")
  .wire("next", logNode, "");

// Доступ к свойствам ноды
console.log(event.uuid); // UUID ноды
console.log(event.name); // "onClick"
```

## Расширения (Extensions)

Библиотека поддерживает создание расширений через метод `inject`:

```typescript
const baseCommutator = Commutator.initialize()...;

const mathExtension = Commutator.initialize()
  .definePureFunction("multiply", {...})
  .definePureFunction("divide", {...});

const combined = baseCommutator.inject(mathExtension);
```

**Примеры расширений:**

- `@commutator/flow-control` — ноды управления потоком (Branch, ForLoop, Gate и т.д.)
- `@commutator/maths` — математические функции (Add, Subtract, Sin, Cos и т.д.)
- `@commutator/string` — операции со строками
- `@commutator/boolean` — логические операции
- `@commutator/variables` — переменные

## Правила разработки

### 1. Типобезопасность

Библиотека использует строгую типизацию TypeScript. Все типы выводятся автоматически на основе конфигурации коммутатора.

**Важно:**

- Используйте `const` для конфигураций нод и типов данных
- Типы выводятся автоматически, не нужно указывать их явно
- При использовании пользовательских типов данных они должны быть определены до использования
- **НИКОГДА не используйте приведение типов через `as` если этого можно избежать** — всегда предпочитайте правильную типизацию и type guards

### 2. Создание нод

**Правила:**

- Имена нод должны быть уникальными в рамках всего коммутатора (нельзя иметь Event и Function с одинаковым именем)
- Конфигурация ноды должна соответствовать её типу
- Для функций с состоянием используйте `meta` для хранения промежуточных данных
- Используйте `onConfigChange` для реакции на изменения конфигурации

### 3. Работа с пинами

**Правила:**

- Используйте `schema.getPin(nodeUuid, pinName)` для получения пина по имени
- Для динамических пинов определите callback'и `addPinIn/Out` или `addExecPinIn/Out`
- Используйте `actions.resetPins()` в `onConfigChange` для сброса к начальному состоянию

### 4. Валидация и ошибки

**Типы ошибок:**

- `CommutatorError` — базовый класс для всех ошибок библиотеки
- Ошибки валидации типов (несовместимые типы пинов)
- Ошибки циклических связей
- Ошибки self-loop (связь пина с самим собой)
- Ошибки отсутствия конфигураций

**Обработка:**

Все методы валидируют входные данные и выбрасывают `CommutatorError` при ошибках.

### 5. Асинхронность

**Важно:**

- Все функции выполнения (`exec`, `resolveRef`) асинхронные
- Используйте `async/await` при работе с функциями нод
- `exec` в Function должен вызывать переданный `exec` callback для продолжения выполнения
- `exec` в PureFunction возвращает `Promise` со значениями выходных пинов

### 6. Кеширование

**Pull-стратегия (PureFunctions, Refs):**

- Вычисляются только при запросе значения
- Кешируются в `runtimePinCache` на время одного `triggerEvent`
- После завершения `triggerEvent` кеш очищается

**Push-стратегия (Events, Functions):**

- Events: кешируют payload в `pinCache`
- Functions: кешируют выходные значения в `pinCache` и `runtimePinCache`
- Значения сохраняются между вызовами `triggerEvent`
- Метаданные (`meta`) сохраняются в `metaCache`

### 7. Тестирование

**ОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ:**

- **На весь новый код должны быть написаны тесты** — это обязательное требование, не рекомендация
- Тестируйте каждую ноду изолированно
- Проверяйте валидацию типов при создании связей
- Тестируйте обнаружение циклических связей
- Проверяйте работу с динамическими пинами
- Тестируйте сериализацию/десериализацию снапшотов
- Покрывайте тестами все граничные случаи и обработку ошибок

### 8. Производительность

**Оптимизации:**

- PureFunctions кешируются в рамках одного `triggerEvent`
- Refs загружаются один раз за `triggerEvent`
- Используйте снапшоты для сохранения состояния
- Избегайте создания избыточных связей
- Минимизируйте количество нод с состоянием (`meta`)

## Примеры использования

### Базовый пример

```typescript
import { Commutator, CommonDataType } from "@commutator/core";

// 1. Создание коммутатора
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
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
    }),
  })
  .defineFunction("log", {
    pinsIn: {
      message: { type: CommonDataType.Any },
    },
    pinsOut: {},
    execPinsIn: { "": {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(pinsIn.message);
      await exec({ execPinOut: "next", pinsOut: {}, meta: null });
    },
  });

// 2. Создание схемы
const schema = commutator.createSchema();

// 3. Создание нод с Fluent API
const event = schema.createEvent("onClick");
const add = schema.createPureFunction("add");
const log = schema.createFunction("log");

// 4. Подключение пинов
event.wire("x", add, "a").wire("y", add, "b").wire("next", log, "");

schema.wire({
  from: { node: add.uuid, pin: "result" },
  to: { node: log.uuid, pin: "message" },
});

// 5. Создание воркера и выполнение
const worker = schema.createWorker();
await worker.triggerEvent("onClick", { x: 10, y: 20 });
// Console: 30

// 6. Сохранение и восстановление
const schemaSnapshot = schema.extract();
const workerSnapshot = worker.extract();

const restoredSchema = commutator.createSchema(schemaSnapshot);
const restoredWorker = restoredSchema.createWorker(workerSnapshot);
```

### Функция с состоянием (Counter)

```typescript
const commutator = Commutator.initialize()
  .defineEvent("onTick", {
    pinsOut: {},
    execPinsOut: { next: {} },
  })
  .defineFunction("counter", {
    pinsIn: {
      step: { type: CommonDataType.Number, default: 1 },
    },
    pinsOut: {
      count: { type: CommonDataType.Number },
    },
    execPinsIn: { "": {} },
    execPinsOut: { next: {} },
    meta: { type: CommonDataType.Number },
    exec: async ({ pinsIn, meta, exec }) => {
      const newCount = (meta ?? 0) + (pinsIn.step ?? 1);
      await exec({
        execPinOut: "next",
        pinsOut: { count: newCount },
        meta: newCount,
      });
    },
  });

const schema = commutator.createSchema();
const tick = schema.createEvent("onTick");
const counter = schema.createFunction("counter");

tick.wire("next", counter, "");

const worker = schema.createWorker();
await worker.triggerEvent("onTick", {}); // count = 1
await worker.triggerEvent("onTick", {}); // count = 2
await worker.triggerEvent("onTick", {}); // count = 3
```

### Динамические пины

```typescript
const commutator = Commutator.initialize().definePureFunction("join", {
  pinsIn: {
    separator: { type: CommonDataType.String, default: ", " },
    input_0: { type: CommonDataType.String },
  },
  pinsOut: {
    result: { type: CommonDataType.String },
  },
  addPinIn: ({ actions }) => {
    const pins = actions.getAllPins();
    const inputPins = pins.filter(
      (p) => p.type === PinInstanceType.Input && p.name.startsWith("input_")
    );
    const nextIndex = inputPins.length;
    actions.addPin(`input_${nextIndex}`, PinInstanceType.Input, {
      type: CommonDataType.String,
    });
  },
  exec: async ({ pinsIn }) => {
    const values = Object.entries(pinsIn)
      .filter(([key]) => key.startsWith("input_"))
      .map(([, value]) => value ?? "");
    return {
      result: values.join(pinsIn.separator ?? ", "),
    };
  },
});
```

### Использование расширений

```typescript
import { Commutator } from "@commutator/core";
import { flowControlExtension } from "@commutator/flow-control";
import { mathsExtension } from "@commutator/maths";

const commutator = Commutator.initialize()
  .inject(flowControlExtension)
  .inject(mathsExtension);

const schema = commutator.createSchema();
const branch = schema.createFunction("Branch");
const add = schema.createPureFunction("Add");
```

## Заключение

Commutator — это мощная библиотека для создания визуальных блюпринтов с полной типобезопасностью TypeScript. Трёхслойная архитектура обеспечивает разделение ответственности между определением типов (Commutator), созданием схем (CommutatorSchema) и выполнением графов (CommutatorWorker).

При разработке следуйте правилам типобезопасности, используйте расширения для модульности и тестируйте все компоненты изолированно.
