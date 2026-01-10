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
  .defineDataType("Order", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      items: {
        type: CommonDataType.Array,
        itemType: {
          type: CommonDataType.Object,
          properties: {
            name: { type: CommonDataType.String },
            price: { type: CommonDataType.Number },
            quantity: { type: CommonDataType.Number },
          },
        },
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
      process: {},
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
  .definePureFunction("calculateTotal", {
    pinsIn: {
      items: {
        type: CommonDataType.Array,
        items: {
          type: CommonDataType.Object,
          properties: {
            price: { type: CommonDataType.Number },
            quantity: { type: CommonDataType.Number },
          },
        },
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
      start: {},
    },
    execPinsOut: {
      valid: {},
      invalid: {},
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
      start: {},
    },
    execPinsOut: {
      success: {},
      failure: {},
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
const orderCreated = schema
  .createEvent("onOrderCreated")
  .wire("orderId", schema.createRef("orderRef", { orderId: "order-123" }), "orderId");

const orderRef = schema.createRef("orderRef", { orderId: "order-123" });
const calculateTotal = schema.createPureFunction("calculateTotal");
const applyDiscount = schema.createPureFunction("applyDiscount");
const validateOrder = schema.createFunction("validateOrder");
const processPayment = schema.createFunction("processPayment", { apiKey: "api-key-123" });

// Создание связей
schema.wire(orderRef.uuid, "order", calculateTotal.uuid, "items");
schema.wire(calculateTotal.uuid, "total", applyDiscount.uuid, "amount");
schema.wire(orderRef.uuid, "order", validateOrder.uuid, "order");
schema.wire(applyDiscount.uuid, "finalAmount", processPayment.uuid, "amount");

// Exec-связи
schema.wire(orderCreated.uuid, "process", validateOrder.uuid, "start");
schema.wire(validateOrder.uuid, "valid", processPayment.uuid, "start");

// Экспорт в снапшот
const snapshot = schema.extract();

// Восстановление из снапшота
const restoredSchema = workflowCommutator.createSchema(snapshot);

export { workflowCommutator, schema, restoredSchema, snapshot };
