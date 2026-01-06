# Commutator - Документация для AI агентов

## Обзор

**Commutator** — это библиотека для создания визуальных блюпринтов (blueprints) в стиле Unreal Engine Blueprints. Библиотека позволяет создавать визуальные графы из нод, которые могут выполнять вычисления, обрабатывать события и управлять потоком выполнения.

Библиотека состоит из трёх основных слоёв:

1. **Commutator** (Коммутатор) — слой настройки типов нод и типов данных блюпринта
2. **CommutatorSchema** (Схема) — слой настройки конкретного блюпринта, связей между нодами и структуры графа
3. **CommutatorInstance** (Инстанс) — слой выполнения, отвечающий за хранение промежуточных состояний, метаданных и запуск блюпринта

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
Commutator.initialize() // Создание нового коммутатора
.defineDataType(name, field) // Определение пользовательского типа данных
.defineEvent(name, config) // Определение типа события
.defineRef(name, config) // Определение типа референса
.definePureFunction(name, config) // Определение чистой функции
.defineFunction(name, config) // Определение функции
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
    canAddPinIn: false,
    canAddPinOut: false,
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
.createEvent(name, config?) // Создание экземпляра события
.createRef(name, config?) // Создание экземпляра референса
.createPureFunction(name, config?) // Создание экземпляра чистой функции
.createFunction(name, config?) // Создание экземпляра функции
.wire(fromPinUuid, toPinUuid) // Создание связи между пинами
.unwire(fromPinUuid, toPinUuid) // Удаление связи
.addPin(nodeUuid, name, type) // Добавление пина к ноде
.removePin(pinUuid) // Удаление пина из ноды
.moveNode(nodeUuid, x, y) // Перемещение ноды
.getNodePins(nodeUuid) // Получение всех пинов ноды
.extract() // Экспорт схемы в снапшот
```

**Правила валидации:**

1. **Типы данных:** При создании связи между data-пинами проверяется совместимость типов
2. **Циклические связи:** Запрещены циклические связи в графе (проверка выполняется автоматически)
3. **Уникальность входов:** Data-пин на входе может иметь только одну входящую связь
4. **Exec-пины:** Могут иметь множественные входы
5. **Динамические пины:** Можно добавлять/удалять пины только если `canAddPinIn/Out` или `canAddExecPinIn/Out` разрешены

**Пример:**

```typescript
const schema = commutator.createSchema();
const onClickEvent = schema.createEvent("onClick");
const addFunction = schema.createPureFunction("add");

const eventOutputPin = schema
  .getNodePins(onClickEvent.uuid)
  .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
const functionInputPin = schema
  .getNodePins(addFunction.uuid)
  .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

schema.wire(eventOutputPin.uuid, functionInputPin.uuid);
```

### Слой 3: CommutatorInstance (Инстанс)

**Назначение:** Выполнение блюпринта, хранение промежуточных состояний и метаданных.

**Примечание:** Слой выполнения находится в разработке. Предполагаемая функциональность:

- Хранение значений пинов (кеширование результатов выполнения)
- Управление метаданными нод
- Выполнение графа по exec-пинам
- Pull-стратегия для pure functions (вычисление по требованию)
- Push-стратегия для functions (выполнение при триггере exec-пина)

**Промежуточные значения:**

Промежуточные значения хранятся в двух местах:

1. **meta в каждой ноде** — метаданные ноды, которые сохраняются между вызовами и используются для хранения состояния ноды (например, счётчик, флаги и т.д.)

2. **Кеширование в пинах** — Functions и Events кешируют промежуточные данные в своих выходных пинах (pinsOut). Значения кешируются после выполнения функции и используются при последующих обращениях к пину, пока функция не будет вызвана снова

## Типы нод

### Event (Событие)

**Назначение:** Точка входа в блюпринт, триггерится извне.

**Характеристики:**
- Имеет только выходные пины (pinsOut, execPinsOut)
- Не имеет входных пинов
- Используется для инициирования выполнения графа
- **Кеширует промежуточные данные в выходных пинах** — значения пинов сохраняются после триггера события и используются до следующего триггера

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
})
```

### PureFunction (Чистая функция)

**Назначение:** Функция без побочных эффектов, вычисляет результат на основе входных данных.

**Характеристики:**
- Имеет входные и выходные data-пины
- Не имеет exec-пинов
- Выполняется по pull-стратегии (когда требуется значение)
- **Не кеширует промежуточные данные** — вычисляется каждый раз при запросе значения

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
  canAddPinIn: false,
  canAddPinOut: false,
  exec: async ({ pinsIn }) => ({
    result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
  }),
})
```

### Function (Функция)

**Назначение:** Функция с побочными эффектами и управлением потоком выполнения.

**Характеристики:**
- Имеет входные и выходные data-пины
- Имеет входные и выходные exec-пины
- Выполняется по push-стратегии (при триггере exec-пина)
- Может иметь метаданные (meta) для хранения состояния между вызовами
- Может управлять потоком выполнения через exec-пины
- **Кеширует промежуточные данные в выходных пинах** — значения выходных пинов сохраняются после выполнения функции и используются при последующих обращениях, пока функция не будет вызвана снова

**Пример:**

```typescript
.defineFunction("log", {
  pinsIn: {
    message: { type: CommonDataType.String },
  },
  pinsOut: {},
  execPinsIn: {
    start: {},
  },
  execPinsOut: {
    next: {},
  },
  canAddPinIn: false,
  canAddPinOut: false,
  canAddExecPinIn: false,
  canAddExecPinOut: false,
  exec: async ({ pinsIn, exec }) => {
    console.log(pinsIn.message);
    await exec({
      execPinOut: "next",
      pinsOut: {},
      meta: null,
    });
  },
})
```

### Ref (Референс)

**Назначение:** Загрузка внешних сущностей по метаданным.

**Характеристики:**
- Имеет выходные пины (pinsOut)
- Использует `resolveRef` для загрузки данных
- Имеет доступ к API для работы с внешними системами
- **Не кеширует промежуточные данные** — данные загружаются каждый раз при запросе

**Пример:**

```typescript
.defineRef("userRef", {
  pinsOut: {
    user: { type: CommonDataType.String },
  },
  resolveRef: async ({ config, api }) => {
    const user = await api.userService.getById(config.userId);
    return { user: user.name };
  },
})
```

## Типы данных

### Базовые типы (CommonDataType)

- `Any` — любой тип (принимает все типы при валидации)
- `String` — строка
- `Number` — число
- `Boolean` — булево значение
- `Date` — дата (хранится как число)
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

## Пины (Pins)

### Типы пинов

1. **Input/Output** — data-пины для передачи данных
2. **InputExec/OutputExec** — exec-пины для управления потоком выполнения

### Характеристики пинов

- **default** — значение по умолчанию, если к пину ничего не подключено
- **type** — тип данных пина (для data-пинов)
- **name** — имя пина
- **uuid** — уникальный идентификатор экземпляра пина

### Правила работы с пинами

1. Data-пин на входе может иметь только одну входящую связь
2. Exec-пины могут иметь множественные входы
3. При создании связи проверяется совместимость типов (кроме `Any`)
4. Пины можно добавлять/удалять только если это разрешено в конфигурации ноды

## Связи (Wires)

**Назначение:** Соединение пинов для передачи данных и управления потоком.

**Правила:**

1. Связь создаётся между выходным и входным пином одного типа (data или exec)
2. Запрещены циклические связи
3. Запрещены self-loop (связь пина с самим собой)
4. При удалении связи метод `unwire` работает идемпотентно

**Пример:**

```typescript
schema.wire(outputPinUuid, inputPinUuid);
schema.unwire(outputPinUuid, inputPinUuid);
```

## Расширения (Extensions)

Библиотека поддерживает создание расширений через метод `inject`:

```typescript
const baseCommutator = Commutator.initialize()...;
const extension = Commutator.initialize()
  .defineFunction("customFunction", {...});

const combined = baseCommutator.inject(extension);
```

**Примеры расширений:**

- `@commutator/flow-control` — ноды управления потоком (Branch, Switch, Gate и т.д.)
- `@commutator/maths` — математические функции (Add, Subtract, Sin, Cos и т.д.)

## Снапшоты (Snapshots)

**CommutatorInstanceSnapshot** — сериализуемое представление схемы:

```typescript
interface CommutatorInstanceSnapshot {
  events: EventNodeInstance<any>[];
  refs: RefNodeInstance<any>[];
  pureFunctions: PureFunctionNodeInstance<any>[];
  functions: FunctionNodeInstance<any>[];
  pinInstances: PinInstance[];
  wires: Wire[];
}
```

**Использование:**

```typescript
// Экспорт
const snapshot = schema.extract();

// Импорт
const schema = commutator.createSchema(snapshot);
```

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

- Имена нод должны быть уникальными в рамках одного типа (Event, Ref, PureFunction, Function)
- Конфигурация ноды должна соответствовать её типу
- Для функций с состоянием используйте `meta` для хранения промежуточных данных

**Пример правильной конфигурации:**

```typescript
.defineFunction("counter", {
  pinsIn: { step: { type: CommonDataType.Number } },
  pinsOut: { value: { type: CommonDataType.Number } },
  execPinsIn: { "": {} },
  execPinsOut: { next: {} },
  canAddPinIn: false,
  canAddPinOut: false,
  canAddExecPinIn: false,
  canAddExecPinOut: false,
  meta: { type: CommonDataType.Number }, // Состояние
  exec: async ({ pinsIn, meta, exec }) => {
    const newValue = (meta ?? 0) + (pinsIn.step ?? 1);
    await exec({
      execPinOut: "next",
      pinsOut: { value: newValue },
      meta: newValue,
    });
  },
})
```

### 3. Работа с пинами

**Правила:**

- Всегда проверяйте наличие пина перед созданием связи
- Используйте `getNodePins` для получения списка пинов ноды
- При добавлении динамических пинов проверяйте флаги `canAddPinIn/Out`

**Пример:**

```typescript
const pins = schema.getNodePins(nodeUuid);
const outputPin = pins.find(
  (pin) => pin.name === "value" && pin.type === PinInstanceType.Output
);
```

### 4. Валидация и ошибки

**Типы ошибок:**

- `CommutatorError` — базовый класс для всех ошибок библиотеки
- Ошибки валидации типов
- Ошибки циклических связей
- Ошибки отсутствия конфигураций

**Обработка:**

Все методы валидируют входные данные и выбрасывают `CommutatorError` при ошибках.

### 5. Асинхронность

**Важно:**

- Все функции выполнения (`exec`, `resolveRef`) асинхронные
- Используйте `async/await` при работе с функциями нод
- Exec-функции должны возвращать `Promise<void>`
- Pure-функции должны возвращать `Promise<PinRecordValue>`

### 6. Расширяемость

**Создание расширений:**

1. Создайте новый пакет в `packages/`
2. Используйте `Commutator.initialize()` для создания базового коммутатора
3. Определите необходимые ноды и типы данных
4. Экспортируйте готовое расширение
5. Используйте `inject` для объединения с другими коммутаторами

**Пример структуры расширения:**

```typescript
// packages/my-extension/index.ts
import { Commutator, CommonDataType } from "@commutator/core";

export const myExtension = Commutator.initialize()
  .defineFunction("myFunction", {
    // конфигурация
  });

// Использование
import { myExtension } from "@commutator/my-extension";
const commutator = baseCommutator.inject(myExtension);
```

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

- Pure-функции могут кешировать результаты
- Используйте снапшоты для сохранения состояния
- Избегайте создания избыточных связей
- Минимизируйте количество нод с состоянием (meta)

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
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
    }),
  });

// 2. Создание схемы
const schema = commutator.createSchema();
const event = schema.createEvent("onClick");
const add = schema.createPureFunction("add");

// 3. Создание связей
const eventXPin = schema
  .getNodePins(event.uuid)
  .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
const addAPin = schema
  .getNodePins(add.uuid)
  .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

schema.wire(eventXPin.uuid, addAPin.uuid);

// 4. Экспорт снапшота
const snapshot = schema.extract();
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

Commutator — это мощная библиотека для создания визуальных блюпринтов с полной типобезопасностью TypeScript. Трёхслойная архитектура обеспечивает разделение ответственности между определением типов, созданием схем и выполнением графов.

При разработке следуйте правилам типобезопасности, используйте расширения для модульности и тестируйте все компоненты изолированно.

