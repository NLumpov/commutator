/**
 * Пример 16: Комплексный пример с воркером
 *
 * Демонстрирует:
 * - Полный цикл работы с воркером
 * - Комбинация всех типов нод
 * - Ref с загрузкой данных
 * - PureFunction с вычислениями
 * - Function с состоянием и ветвлением
 * - Сохранение и восстановление полного состояния
 */

import { CommonDataType, Commutator } from "@commutator/core";

const commutator = Commutator.initialize()
  .defineDataType("Product", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      name: { type: CommonDataType.String },
      price: { type: CommonDataType.Number },
      stock: { type: CommonDataType.Number },
    },
  })
  .defineEvent("onPurchase", {
    pinsOut: {
      productId: { type: CommonDataType.String },
      quantity: { type: CommonDataType.Number },
    },
    execPinsOut: {
      process: null,
    },
  })
  .defineApi("productService", {
    getById: async (id: string) => {
      // Симуляция загрузки продукта
      const products: Record<string, any> = {
        "prod-1": { id: "prod-1", name: "Laptop", price: 999, stock: 10 },
        "prod-2": { id: "prod-2", name: "Mouse", price: 29, stock: 50 },
        "prod-3": { id: "prod-3", name: "Keyboard", price: 79, stock: 30 },
      };
      return products[id] || { id, name: "Unknown", price: 0, stock: 0 };
    },
  })
  .defineRef("productRef", {
    pinsOut: {
      product: { type: "Product" },
      stock: { type: CommonDataType.Number },
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        productId: { type: CommonDataType.String },
      },
    },
    resolveRef: async ({ config, api }) => {
      const productId = config?.productId ?? "unknown";
      console.log(`  📦 Загрузка продукта: ${productId}`);
      const product = await api.productService.getById(productId);
      return {
        product,
        stock: product?.stock ?? 0,
      };
    },
  })
  .definePureFunction("extractPrice", {
    pinsIn: {
      product: { type: "Product" },
    },
    pinsOut: {
      price: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const product = pinsIn.product as any;
      const price = product?.price ?? 0;
      console.log(`  💵 Извлечение цены: ${price}`);
      return { price };
    },
  })
  .definePureFunction("calculateTotal", {
    pinsIn: {
      price: { type: CommonDataType.Number },
      quantity: { type: CommonDataType.Number },
    },
    pinsOut: {
      total: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const total = (pinsIn.price ?? 0) * (pinsIn.quantity ?? 0);
      console.log(`  💰 Расчёт: ${pinsIn.price} × ${pinsIn.quantity} = ${total}`);
      return { total };
    },
  })
  .defineFunction("inventory", {
    pinsIn: {
      productId: { type: CommonDataType.String },
      quantity: { type: CommonDataType.Number },
      initialStock: { type: CommonDataType.Number },
    },
    pinsOut: {
      remaining: { type: CommonDataType.Number },
    },
    execPinsIn: {
      update: null,
    },
    execPinsOut: {
      success: null,
      outOfStock: null,
    },
    meta: {
      type: CommonDataType.Object,
      properties: {
        productId: { type: CommonDataType.String },
        stock: { type: CommonDataType.Number },
      },
    },
    exec: async ({ pinsIn, meta, exec }) => {
      const quantity = pinsIn.quantity ?? 0;
      const initialStock = pinsIn.initialStock;

      // Определяем текущий stock: сначала из метаданных, потом из initialStock, иначе 0
      let currentStock: number;
      const metaData = meta as any;

      // Проверяем метаданные - они могут быть объектом с полями stock и productId
      // Важно: проверяем именно наличие и валидность stock в метаданных
      if (
        metaData &&
        typeof metaData === "object" &&
        "stock" in metaData &&
        typeof metaData.stock === "number" &&
        metaData.stock > 0
      ) {
        // Используем сохранённый stock из метаданных
        currentStock = metaData.stock;
      } else if (typeof initialStock === "number" && initialStock > 0) {
        // Используем initialStock только если метаданных нет или stock = 0
        currentStock = initialStock;
      } else {
        currentStock = 0;
      }

      const newStock = currentStock - quantity;

      console.log(`  📦 Обновление инвентаря: ${currentStock} - ${quantity} = ${newStock}`);

      if (newStock >= 0) {
        await exec({
          execPinOut: "success",
          pinsOut: { remaining: newStock },
          meta: { productId: pinsIn.productId ?? "", stock: newStock },
        });
      } else {
        await exec({
          execPinOut: "outOfStock",
          pinsOut: { remaining: 0 },
          meta: { productId: pinsIn.productId ?? "", stock: currentStock }, // Сохраняем текущий stock, не обнуляем
        });
      }
    },
  })
  .defineFunction("processPayment", {
    pinsIn: {
      total: { type: CommonDataType.Number },
    },
    pinsOut: {
      transactionId: { type: CommonDataType.String },
    },
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      success: null,
    },
    exec: async ({ pinsIn, exec }) => {
      const transactionId = `txn-${Date.now()}`;
      console.log(`  💳 Платёж обработан: ${pinsIn.total} (ID: ${transactionId})`);
      await exec({
        execPinOut: "success",
        pinsOut: { transactionId },
        meta: null,
      });
    },
  })
  .defineFunction("logResult", {
    pinsIn: {
      message: { type: CommonDataType.String, default: "" },
    },
    pinsOut: {},
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      next: null,
    },
    exec: async ({ pinsIn, exec }) => {
      const message = pinsIn.message ?? "";
      if (message) {
        console.log(`  ✅ ${message}`);
      }
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

// Создание схемы
const schema = commutator.createSchema();

const onPurchase = schema.createEvent("onPurchase");
const productRef = schema.createRef("productRef", { productId: "prod-1" });
const extractPrice = schema.createPureFunction("extractPrice");
const calculateTotal = schema.createPureFunction("calculateTotal");
const inventory = schema.createFunction("inventory");
const processPayment = schema.createFunction("processPayment");
const logSuccess = schema.createFunction("logResult");
const logOutOfStock = schema.createFunction("logResult");

// Подключение графа
onPurchase.wire("process", inventory, "update");
// productId передаётся через конфигурацию productRef при каждом вызове
// Для упрощения используем один productRef с фиксированным productId
schema.wire({
  from: { node: onPurchase.uuid, pin: "productId" },
  to: { node: inventory.uuid, pin: "productId" },
});
schema.wire({
  from: { node: onPurchase.uuid, pin: "quantity" },
  to: { node: inventory.uuid, pin: "quantity" },
});
schema.wire({
  from: { node: productRef.uuid, pin: "stock" },
  to: { node: inventory.uuid, pin: "initialStock" },
});
schema.wire({
  from: { node: productRef.uuid, pin: "product" },
  to: { node: extractPrice.uuid, pin: "product" },
});
schema.wire({
  from: { node: extractPrice.uuid, pin: "price" },
  to: { node: calculateTotal.uuid, pin: "price" },
});
schema.wire({
  from: { node: onPurchase.uuid, pin: "quantity" },
  to: { node: calculateTotal.uuid, pin: "quantity" },
});
schema.wire({
  from: { node: calculateTotal.uuid, pin: "total" },
  to: { node: processPayment.uuid, pin: "total" },
});
inventory.wire("success", processPayment, "start");
inventory.wire("outOfStock", logOutOfStock, "start");
processPayment.wire("success", logSuccess, "start");

// Настройка сообщений для логирования через установку значений по умолчанию для пинов
const logSuccessMessagePin = schema.getPin(logSuccess.uuid, "message");
const logOutOfStockMessagePin = schema.getPin(logOutOfStock.uuid, "message");
schema.setPinDefaultValue(logSuccessMessagePin.uuid, "Покупка успешно завершена!");
schema.setPinDefaultValue(logOutOfStockMessagePin.uuid, "Товара нет в наличии!");

const worker = schema.createWorker();

console.log("✅ Пример 16: Комплексный пример с воркером");
console.log("\n=== Покупка 3 единиц товара ===");
await worker.triggerEvent("onPurchase", { productId: "prod-1", quantity: 3 });

console.log("\n=== Покупка ещё 5 единиц ===");
await worker.triggerEvent("onPurchase", { productId: "prod-1", quantity: 5 });

console.log("\n=== Попытка купить 10 единиц (должно быть недостаточно) ===");
await worker.triggerEvent("onPurchase", { productId: "prod-1", quantity: 10 });

console.log("\n=== Сохранение полного состояния ===");
const workerSnapshot = worker.extract();
console.log(`  - Кешированных значений: ${workerSnapshot.pinCache.length}`);
console.log(`  - Кешированных метаданных: ${workerSnapshot.metaCache.length}`);

console.log("\n✅ Комплексный пример выполнен успешно!");

export { commutator, schema, worker, workerSnapshot };
