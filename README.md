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
      keys: {
        id: { type: CommonDataType.Number, name: "ID Пользователя" },
      },
      state: CustomDataType.User,
      // load подгружает сущность в ноду, если она ещё не загружена
      load: (keys) =>
        fetch(`https://jsonplaceholder.typicode.com/user/${keys.id}`).then(
          (r) => r.json()
        ),
      // Устанавливает keys геттера, которые потом позволят загрузить сущность
      set: (id) => {
        id: id;
      },
    },
  },
});

const remoteGetter = commutator.createRemoteGetterNode({
  type: CustomDataType.User,
});

remoteGetter.set({ id: 1 });

// Загружает юзера в память геттерНоды, после чего возвращает её
const user = await remoteGetter.get();
```

### Macros

Макрос фактически является набором из скрытых стейтов, публичных стейтов, приёмщиков, хендлера и триггера. У него может быть вообще любая структура, единственное ограничение - хендлер и триггер может быть только один. А может и не быть.

```ts
import {
  configureCommutator,
  CommonDataType,
  commonDataTypes,
  commonMacros,
} from "@all-mentors/commutator";

const CustomDataType = {
  User: "User",
} as const;

const CustomMacros = {
  CreateEntity: "CreateEntity",
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
  macros: {
    ...commonMacros,
    [CustomMacros.CreateUser]: {
      // Скрытый стейт нужен для хранения каких-либо данных, которые не будут показываться публично
      // и которые будут использоваться только во внутренних обработчиках макроса.
      // Меняются только выполнением хендлера. HiddenState нельзя сконнектить с другими полями
      hiddenStates: {
        isCreated: { type: CommonDataType.Boolean, name: "Создан" },
      },
      // Публичный стейт, который изменяется при выполнении хендлера.
      // Публичный стейт можно соединить с консюмерами, как будто это GetterNode.
      sharedStates: {
        user: CustomDataType.User,
      },
      // Ноды, которые принимают какие-то значения. При запуске хендлера происходит
      // ленивое вычисление их состояния, а в хендлер передаётся результат этого вычисления
      consumers: {
        name: { type: CommonDataType.String, name: "Имя" },
      },
      // Хендлер вызывается в момент триггера
      handler: async ({ hiddenStates, sharedStates, consumers, api, self }) => {
        const userResponse = await fetch(
          "https://jsonplaceholder.typicode.com/user",
          {
            method: "POST",
            data: { name: consumers.name, createdFromMacros: self.id },
          }
        );

        hiddenStates.isCreated = true;
        sharedStates.user = await userResponse.json();
      },
      // Сразу триггерим событие после резолва хендлера
      onHandlerResolved: ({
        hiddenStates,
        sharedStates,
        consumers,
        api,
        self,
      }) => self.trigger(),
      // Если хендлер не зарезолвился то кидаем ошибку в логгер и можем например совершить какие-то роллбек действия
      onHandlerCatched: ({
        hiddenStates,
        sharedStates,
        consumers,
        api,
        self,
        error,
      }) => fetch("https://sentry.io/logger", { data: error.message }),
      // Можно ли затриггерить ноду
      triggerable: true,
    },
  },
});

// Триггерим макросы с типом CreateUser где isCreated false и user =
commutator.triggerMacrosWhere({
  type: CustomMacros.CreateUser,
  hiddenStates: {
    isCreated: false,
  },
});

// Ищем все макросы по стейтам
const allCreateUserMacrosThatNotCalled = commutator.findMacrosWhere({
  type: CustomMacros.CreateUser,
  hiddenStates: {
    isCreated: false,
  },
});

// Триггерим макрос напрямую
allCreateUserMacrosThatNotCalled[0].trigger();
```

### Загрузка состояния

Бывают ситуации, когда коммутатор надо восстановить из каких-то уже существующих данных. Для этого в configureCommutator есть специальное поле preloadedState.

```ts
import { configureCommutator } from "@all-mentors/commutator";

const commutator = configureCommutator({
  preloadedState: { macros: [], remoteGetterNodes: [], staticGetterNodes: [] },
});
```
