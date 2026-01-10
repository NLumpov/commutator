# Примеры использования Commutator

Этот пакет содержит комплексные примеры применения всех возможностей библиотеки Commutator.

## Структура примеров

### 01-basic-commutator-methods.ts
**Базовые методы Commutator**

Демонстрирует основные методы создания коммутатора:
- `Commutator.initialize()` - создание базового коммутатора
- `defineDataType()` - определение пользовательских типов данных
- `defineEvent()` - определение событий
- `definePureFunction()` - определение чистых функций
- `defineFunction()` - определение функций с побочными эффектами
- `defineRef()` - определение референсов
- `defineApi()` - определение API
- `createSchema()` - создание схемы из коммутатора

### 02-all-data-types.ts
**Все типы данных**

Покрывает использование всех доступных типов данных:
- `String` - строки
- `Number` - числа
- `Boolean` - булевы значения
- `Date` - даты
- `Object` - объекты с определенными свойствами
- `Array` - массивы с типизированными элементами
- `StringEnum` - перечисления строковых значений
- `NumberEnum` - перечисления числовых значений
- `Any` - любой тип

### 03-schema-node-creation.ts
**Создание нод в схеме**

Демонстрирует создание различных типов нод:
- `createEvent()` - создание событий
- `createRef()` - создание референсов
- `createPureFunction()` - создание чистых функций
- `createFunction()` - создание функций
- Создание нод с конфигурацией

### 04-wiring-pins.ts
**Подключение пинов**

Показывает различные способы подключения пинов:
- `wire(node, pinName, node, pinName)` - упрощенный синтаксис
- `wire(uuid, uuid)` - оригинальный метод по UUID
- `wireWithOptions()` - подключение с именованными параметрами
- `unwire()` - отключение пинов
- Подключение data-пинов
- Подключение exec-пинов

### 05-fluent-api.ts
**Fluent API**

Демонстрирует использование fluent API для работы с нодами и пинами:
- `FluentNodeBuilder` - возвращается из методов создания нод
- `NodeBuilder` - через `schema.node()`
- `PinBuilder` - через `node().pin()`
- Цепочки методов для создания связей

### 06-dynamic-pins.ts
**Динамические пины**

Показывает работу с динамическими пинами:
- `addPinIn()` - добавление входного data-пина
- `addPinOut()` - добавление выходного data-пина
- `addExecPinIn()` - добавление входного exec-пина
- `addExecPinOut()` - добавление выходного exec-пина
- `removePin()` - удаление пина
- `updatePin()` - обновление пина
- Ноды с динамическими пинами через callbacks

### 07-snapshots.ts
**Снапшоты**

Демонстрирует работу со снапшотами:
- `extract()` - экспорт схемы в снапшот
- `createSchema(snapshot)` - создание схемы из снапшота
- Сериализация и десериализация схем
- Сохранение позиций нод, конфигураций и связей

### 08-config-callbacks.ts
**Callbacks конфигурации**

Показывает использование callbacks:
- `onConfigChange()` - callback при изменении конфигурации
- Динамическое изменение пинов через callbacks
- Использование `actions` в callbacks
- `updateNodeConfig()` - обновление конфигурации ноды

### 09-inject-extensions.ts
**Инъекция расширений**

Демонстрирует создание модульных расширений:
- `inject()` - объединение коммутаторов
- Создание модульных расширений
- Комбинирование функциональности из разных коммутаторов
- Примеры: базовый коммутатор, математическое расширение, строковое расширение

### 10-complex-workflow.ts
**Сложный workflow**

Комплексный пример, объединяющий все возможности:
- Все типы нод (Event, Ref, PureFunction, Function)
- Все типы данных
- Динамические пины
- Fluent API
- Снапшоты
- Callbacks
- Расширения

### 11-node-positioning.ts
**Позиционирование нод**

Демонстрирует работу с позициями нод:
- `moveNode()` - перемещение нод
- Работа с координатами нод
- Использование позиций при экспорте/импорте
- Визуальное расположение графа

### 12-pin-management.ts
**Управление пинами**

Показывает методы управления пинами:
- `getPin()` - получение пина по UUID ноды и имени
- `getNodePins()` - получение всех пинов ноды
- Фильтрация пинов по типу
- Работа с пинами через различные методы

## Использование

Каждый пример можно импортировать и использовать отдельно:

```typescript
import { commutator, schema } from "@commutator/examples/01-basic-commutator-methods";

// Использование созданного коммутатора и схемы
const mySchema = commutator.createSchema();
```

Или использовать все примеры:

```typescript
import * as examples from "@commutator/examples";

// Доступ ко всем примерам
```

## Покрытие функциональности

Эти примеры покрывают:

### Методы Commutator
- ✅ `initialize()`
- ✅ `defineDataType()`
- ✅ `defineEvent()`
- ✅ `defineRef()`
- ✅ `definePureFunction()`
- ✅ `defineFunction()`
- ✅ `defineApi()`
- ✅ `inject()`
- ✅ `createSchema()`

### Методы CommutatorSchema
- ✅ `createEvent()`
- ✅ `createRef()`
- ✅ `createPureFunction()`
- ✅ `createFunction()`
- ✅ `wire()` (все варианты)
- ✅ `wireWithOptions()`
- ✅ `unwire()`
- ✅ `addPinIn()`
- ✅ `addPinOut()`
- ✅ `addExecPinIn()`
- ✅ `addExecPinOut()`
- ✅ `removePin()`
- ✅ `updatePin()`
- ✅ `moveNode()`
- ✅ `updateNodeConfig()`
- ✅ `node()` (Fluent API)
- ✅ `getPin()`
- ✅ `getNodePins()`
- ✅ `extract()`

### Типы данных
- ✅ `String`
- ✅ `Number`
- ✅ `Boolean`
- ✅ `Date`
- ✅ `Object`
- ✅ `Array`
- ✅ `StringEnum`
- ✅ `NumberEnum`
- ✅ `Any`

### Дополнительные возможности
- ✅ Fluent API (FluentNodeBuilder, NodeBuilder, PinBuilder)
- ✅ Динамические пины
- ✅ Callbacks (onConfigChange)
- ✅ Снапшоты
- ✅ Расширения (inject)

## Запуск примеров

Для запуска конкретного примера:

```bash
bun run packages/examples/01-basic-commutator-methods.ts
```

Или используйте TypeScript напрямую:

```bash
bunx tsx packages/examples/01-basic-commutator-methods.ts
```
