/**
 * Пример 10: Сложный workflow
 *
 * Демонстрирует комбинированное использование всех возможностей:
 * - Все типы нод (Event, Ref, PureFunction, Function)
 * - Все типы данных
 * - Динамические пины
 * - Fluent API
 * - Снапшоты
 * - Callbacks
 * - Расширения
 */

import { CommonDataType, Commutator } from "@commutator/core";

// Создание комплексного коммутатора
const workflowCommutator = Commutator.initialize()
  .defineDataType("OrderItem", {
    type: CommonDataType.Object,
    properties: {
      name: { type: CommonDataType.String },
      price: { type: CommonDataType.Number },
      quantity: { type: CommonDataType.Number },
    },
  })
  .defineDataType("Order", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      items: {
        type: CommonDataType.Array,
        itemType: { type: "OrderItem" },
      },
      status: {
        type: CommonDataType.StringEnum,
        values: ["pending", "processing", "completed", "cancelled"],
      },
    },
  })
  .defineEvent("onOrderCreated", {
    pinsOut: {
      orderId: { type: CommonDataType.String },
      totalAmount: { type: CommonDataType.Number },
    },
    execPinsOut: {
      process: null,
    },
  })
  .defineRef("orderRef", {
    pinsOut: {
      order: { type: "Order" },
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        orderId: { type: CommonDataType.String },
      },
    },
    resolveRef: async ({ config }) => ({
      order: {
        id: config?.orderId ?? "unknown",
        items: [] as Array<{ name: string | null; price: number | null; quantity: number | null }>,
        status: "pending" as const,
      },
    }),
  })
  .definePureFunction("extractItems", {
    pinsIn: {
      order: { type: "Order" },
    },
    pinsOut: {
      items: {
        type: CommonDataType.Array,
        itemType: { type: "OrderItem" },
      },
    },
    exec: async ({ pinsIn }) => {
      const order = pinsIn.order as any;
      const items = order?.items ?? [];
      return { items };
    },
  })
  .definePureFunction("calculateTotal", {
    pinsIn: {
      items: {
        type: CommonDataType.Array,
        itemType: { type: "OrderItem" },
      },
    },
    pinsOut: {
      total: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const items = (pinsIn.items ?? []) as Array<unknown>;
      const total = items.reduce((sum: number, item: unknown) => {
        if (typeof item === "object" && item !== null && "price" in item && "quantity" in item) {
          const price = typeof item.price === "number" ? item.price : 0;
          const quantity = typeof item.quantity === "number" ? item.quantity : 0;
          return sum + price * quantity;
        }
        return sum;
      }, 0);
      return { total };
    },
  })
  .definePureFunction("applyDiscount", {
    pinsIn: {
      amount: { type: CommonDataType.Number },
      discountPercent: { type: CommonDataType.Number },
    },
    pinsOut: {
      finalAmount: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const amount = pinsIn.amount ?? 0;
      const discount = pinsIn.discountPercent ?? 0;
      return {
        finalAmount: amount * (1 - discount / 100),
      };
    },
  })
  .defineFunction("validateOrder", {
    pinsIn: {
      order: { type: "Order" },
      minAmount: { type: CommonDataType.Number },
    },
    pinsOut: {
      isValid: { type: CommonDataType.Boolean },
    },
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      valid: null,
      invalid: null,
    },
    exec: async ({ pinsIn, exec }) => {
      const order = pinsIn.order;
      const isValid =
        order !== undefined &&
        order !== null &&
        typeof order === "object" &&
        "items" in order &&
        Array.isArray(order.items) &&
        order.items.length > 0;

      await exec({
        execPinOut: isValid ? "valid" : "invalid",
        pinsOut: {
          isValid,
        },
        meta: null,
      });
    },
  })
  .defineFunction("processPayment", {
    pinsIn: {
      amount: { type: CommonDataType.Number },
      paymentMethod: {
        type: CommonDataType.StringEnum,
        values: ["credit", "debit", "paypal"],
      },
    },
    pinsOut: {
      transactionId: { type: CommonDataType.String },
    },
    execPinsIn: {
      start: null,
    },
    execPinsOut: {
      success: null,
      failure: null,
    },
    config: {
      type: CommonDataType.Object,
      properties: {
        apiKey: { type: CommonDataType.String },
      },
    },
    exec: async ({ pinsIn, exec, config }) => {
      const amount = pinsIn.amount ?? 0;
      const success = amount > 0 && config?.apiKey !== undefined;

      await exec({
        execPinOut: success ? "success" : "failure",
        pinsOut: {
          transactionId: success ? `txn-${Date.now()}` : "",
        },
        meta: null,
      });
    },
  })
  .defineApi("paymentService", {
    process: async () => {
      return { success: true, transactionId: `txn-${Date.now()}` };
    },
  });

const schema = workflowCommutator.createSchema();

// Создание нод с использованием Fluent API
const orderCreated = schema.createEvent("onOrderCreated");

const orderRef = schema.createRef("orderRef", { orderId: "order-123" });
const extractItems = schema.createPureFunction("extractItems");
const calculateTotal = schema.createPureFunction("calculateTotal");
const applyDiscount = schema.createPureFunction("applyDiscount");
const validateOrder = schema.createFunction("validateOrder");
const processPayment = schema.createFunction("processPayment", { apiKey: "api-key-123" });

// Создание связей
schema.wire({
  from: { node: orderRef.uuid, pin: "order" },
  to: { node: extractItems.uuid, pin: "order" },
});
schema.wire({
  from: { node: extractItems.uuid, pin: "items" },
  to: { node: calculateTotal.uuid, pin: "items" },
});
schema.wire({
  from: { node: calculateTotal.uuid, pin: "total" },
  to: { node: applyDiscount.uuid, pin: "amount" },
});
schema.wire({
  from: { node: orderRef.uuid, pin: "order" },
  to: { node: validateOrder.uuid, pin: "order" },
});
schema.wire({
  from: { node: applyDiscount.uuid, pin: "finalAmount" },
  to: { node: processPayment.uuid, pin: "amount" },
});

// Exec-связи
schema.wire({
  from: { node: orderCreated.uuid, pin: "process" },
  to: { node: validateOrder.uuid, pin: "start" },
});
schema.wire({
  from: { node: validateOrder.uuid, pin: "valid" },
  to: { node: processPayment.uuid, pin: "start" },
});

// Экспорт в снапшот
const snapshot = schema.extract();

// Восстановление из снапшота
const restoredSchema = workflowCommutator.createSchema(snapshot);

console.log("\n✅ Пример 10: Сложный workflow");
console.log("Создан комплексный workflow с:");
console.log(`  - Нод: ${snapshot.nodes.length}`);
console.log(`  - Пинов: ${snapshot.pinInstances.length}`);
console.log(`  - Связей: ${snapshot.wires.length}`);
console.log("Типы нод:");
console.log("  - Event: onOrderCreated");
console.log("  - Ref: orderRef");
console.log("  - PureFunction: calculateTotal, applyDiscount");
console.log("  - Function: validateOrder, processPayment");
console.log("✅ Сложный workflow создан успешно!");

export { workflowCommutator, schema, restoredSchema, snapshot };
