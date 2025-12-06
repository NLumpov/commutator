# Коммутатор - расширяемая библиотека для работы с графами автоматизации

Установка зависимостей:

```bash
bun install
```

Запуск:

```bash
bun run index.ts
```

Сборка:

```bash
bun build index.ts
```

Запуск тестов:

```bash
bun test
```

## Как это работает

Эта библиотека использует pull & push стратегию для выполнения скриптов с определёнными вводными данными

Есть несколько основных бизнес-сущностей

- `DataType`
- `StaticGetterNode`
- `RemoteGetterNode`
- `Macros`
  - `HiddenState<DataType>`
  - `SharedState<DataType>`
  - `Consumer<DataType>`
  - `Handler`
  - `Trigger`

```ts
interface Macros {
  state: Record<string, State>;
}
```

### DataType

Сущность отвечающая за типы данныз. По умолчанию есть 8 базовыех типов данных

1. String
2. Number
3. Date
4. Boolean
5. Object
6. Array
7. StringEnum
8. NumberEnum

Типы прописываются при конфигурации коммутатора, ниже пример настраивающий коммутатор на все 8 базовых типов + добавляющий 2 новых кастомных. Лучше всего хранить кастомные типы в as const енаме, чтобы можно было их переиспользовать.

Стандартные типы обязательно передавать в dataTypes при конфигурации, они вынесены наружу с целью возможности изменения стандартных названий, например name Number'а можно переименовать с "Number" на "Число" для локализации

```ts
import {
  configureCommutator,
  CommonDataType,
  commonDataTypes,
} from "@all-mentors/commutator";

const CustomDataType = {
  UserId: "UserId",
  User: "User",
} as const;

commonDataTypes.String.name = "Строка";
commonDataTypes.Number.name = "Число";

const commutator = configureCommutator({
  dataTypes: {
    ...commonDataTypes,
    [CustomDataType.UserId]: {
      name: "ID Пользователя",
      type: CommonDataType.Number,
    },
    [CustomDataType.User]: {
      name: "Пользователь",
      type: CommonDataType.Object,
      properties: {
        id: CustomDataType.UserId,
        points: {
          type: CommonDataType.Number,
          name: "Баллы",
        },
        roles: {
          type: CommonDataType.Array,
          name: "Роли",
          itemType: {
            type: CommonDataType.StringEnum,
            values: ["Админ", "Пользователь"],
          },
        },
      },
    },
  },
});
```

### StaticGetterNode

Геттер-нода содержащая какое-то статическое значение, например число. Работает максимально просто, содержит в себе значение, которое будет получено при выполнении макроса. Может работать только с примитивными типами - String, Number, Date, Boolean, StringEnum, NumberEnum, а также без проблем работает с алиасами этих примитивных типов, например ниже создан статический геттер для UserId

```ts
import {
  configureCommutator,
  commonStaticGetterNodes,
  commonDataTypes,
  CommonDataType,
} from "@all-mentors/commutator";

const CustomDataType = {
  UserId: "UserId",
} as const;

const commutator = configureCommutator({
  dataTypes: {
    ...commonDataTypes,
    [CustomDataType.UserId]: {
      name: "ID Пользователя",
      type: CommonDataType.Number,
    },
  },
  staticGetterNodes: {
    ...commonStaticGetterNodes,
    [CustomDataType.UserId]: {
      name: "ID пользователя",
      type: CustomDataType.UserId,
    },
  },
});
```

### RemoteGetterNode

Геттер-нода содержащая какое-то значение, которое надо откуда-то загрузить. Зачастую нужны для работы со сложными типами данных, например с объектами, но также может содержать в себе и примитивы. Состоит из функции поиска, геттера и сеттера значения. Геттер загружает текущее значение в соответствии со внутренним стейтом ноды, сеттер превращает сущность во внутренний стейт. В идеале в стейте должен храниться ID удалённой сущности, а не вся сущность, чтобы всегда подгружались актуальные данные при вычислении чего-либо.

```ts
import {
  configureCommutator,
  CommonDataType,
  commonDataTypes,
} from "@all-mentors/commutator";

const CustomDataType = {
  User: "User",
} as const;

const commutator = configureCommutator({
  dataTypes: {
    ...commonDataTypes,
    [CustomDataType.User]: {
      name: "Пользователь",
      type: CommonDataType.Object,
      properties: {
        id: { type: CommonDataType.Number, name: "ID Пользователя" },
        points: {
          type: CommonDataType.Number,
          name: "Баллы",
        },
        roles: {
          type: CommonDataType.Array,
          name: "Роли",
          itemType: {
            type: CommonDataType.StringEnum,
            values: ["Админ", "Пользователь"],
          },
        },
      },
    },
  },
  remoteGetterNodes: {
    [CustomDataType.User]: {
      state: { type: CommonDataType.Number, name: "ID Пользователя" },
      search: (text) =>
        fetch(`https://jsonplaceholder.typicode.com/users?search=${text}`).then(
          (r) => r.json()
        ),
      get: (state) =>
        fetch(`https://jsonplaceholder.typicode.com/users/${state}`).then((r) =>
          r.json()
        ),
      set: (state, user) => user.id,
    },
  },
});
```

### Macros

Макрос фактически является набором 