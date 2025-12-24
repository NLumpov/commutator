# Commutator

Монорепозиторий для библиотеки Commutator, состоящей из ядра и расширений.

## Пакеты

### @commutator/core

Ядро библиотеки Commutator. Содержит основную функциональность и API.

**Установка:**
```bash
bun add @commutator/core
```

**Использование:**
```typescript
import { createCommutator } from "@commutator/core";

const commutator = createCommutator();
```

### @commutator/extension-example

Пример расширения для библиотеки. Демонстрирует, как создавать расширения.

**Установка:**
```bash
bun add @commutator/extension-example
```

## Разработка

### Установка зависимостей

```bash
bun install
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

4. Создайте `index.ts` с вашим расширением

### Работа с workspaces

Все пакеты автоматически связаны через Bun workspaces. Вы можете импортировать пакеты друг в друга используя `workspace:*` в зависимостях.

## Лицензия

MIT
