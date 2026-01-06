# Commutator

Библиотека для создания визуальных блюпринтов (blueprints) в стиле Unreal Engine Blueprints. Commutator позволяет создавать типобезопасные визуальные графы из нод, которые могут выполнять вычисления, обрабатывать события и управлять потоком выполнения.

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
