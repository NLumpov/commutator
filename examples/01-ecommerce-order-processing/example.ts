import { CommonDataType, Commutator } from "@commutator/core";

// Система обработки заказов в интернет-магазине
const commutator = Commutator.initialize()
  .defineDataType("Product", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      name: { type: CommonDataType.String },
      price: { type: CommonDataType.Number },
      quantity: { type: CommonDataType.Number },
    },
  })
  .defineDataType("Order", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      userId: { type: CommonDataType.String },
      products: { type: CommonDataType.Array, itemType: { type: CommonDataType.String } }, // Array of Product IDs
      discountCode: { type: CommonDataType.String },
    },
  })
  .defineEvent("OrderReceived", {
    pinsOut: {
      order: { type: CommonDataType.String }, // Order JSON
    },
    execPinsOut: { next: {} },
  })
  .definePureFunction("ValidateProducts", {
    pinsIn: {
      order: { type: CommonDataType.String },
    },
    pinsOut: {
      isValid: { type: CommonDataType.Boolean },
      validatedOrder: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      // Валидация товаров в заказе
      const order = JSON.parse(pinsIn.order ?? "{}");
      const isValid = order.products && order.products.length > 0;
      return {
        isValid,
        validatedOrder: isValid ? (pinsIn.order ?? "") : "",
      };
    },
  })
  .defineFunction("CheckInventory", {
    pinsIn: {
      order: { type: CommonDataType.String },
    },
    pinsOut: {
      inStock: { type: CommonDataType.Boolean },
      availableOrder: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { available: {}, outOfStock: {} },
    exec: async ({ pinsIn, exec }) => {
      const order = JSON.parse(pinsIn.order ?? "{}");
      // Симуляция проверки наличия
      const inStock = Math.random() > 0.3; // 70% вероятность наличия

      if (inStock) {
        await exec({
          execPinOut: "available",
          pinsOut: {
            inStock: true,
            availableOrder: pinsIn.order ?? "",
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "outOfStock",
          pinsOut: {
            inStock: false,
            availableOrder: "",
          },
          meta: null,
        });
      }
    },
  })
  .definePureFunction("CalculateBasePrice", {
    pinsIn: {
      order: { type: CommonDataType.String },
    },
    pinsOut: {
      basePrice: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const order = JSON.parse(pinsIn.order ?? "{}");
      // Симуляция расчета базовой цены
      const basePrice = (order.products?.length ?? 0) * 100;
      return { basePrice };
    },
  })
  .definePureFunction("ApplyDiscount", {
    pinsIn: {
      basePrice: { type: CommonDataType.Number },
      discountCode: { type: CommonDataType.String },
    },
    pinsOut: {
      discountAmount: { type: CommonDataType.Number },
      priceAfterDiscount: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const discountPercent = pinsIn.discountCode === "SAVE10" ? 0.1 : 0;
      const discountAmount = (pinsIn.basePrice ?? 0) * discountPercent;
      const priceAfterDiscount = (pinsIn.basePrice ?? 0) - discountAmount;
      return { discountAmount, priceAfterDiscount };
    },
  })
  .definePureFunction("CalculateTax", {
    pinsIn: {
      price: { type: CommonDataType.Number },
    },
    pinsOut: {
      tax: { type: CommonDataType.Number },
      totalPrice: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const taxRate = 0.2; // 20% налог
      const tax = (pinsIn.price ?? 0) * taxRate;
      const totalPrice = (pinsIn.price ?? 0) + tax;
      return { tax, totalPrice };
    },
  })
  .defineFunction("ProcessPayment", {
    pinsIn: {
      orderId: { type: CommonDataType.String },
      totalPrice: { type: CommonDataType.Number },
    },
    pinsOut: {
      paymentId: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { success: {}, failed: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция обработки платежа
      const success = Math.random() > 0.2; // 80% успешных платежей

      if (success) {
        await exec({
          execPinOut: "success",
          pinsOut: {
            paymentId: `pay_${Date.now()}`,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "failed",
          pinsOut: {
            paymentId: "",
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("SendNotification", {
    pinsIn: {
      userId: { type: CommonDataType.String },
      message: { type: CommonDataType.String },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(`[Notification] To user ${pinsIn.userId}: ${pinsIn.message}`);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const orderReceived = schema.createEvent("OrderReceived");
const validateProducts = schema.createPureFunction("ValidateProducts");
const checkInventory = schema.createFunction("CheckInventory");
const calculateBasePrice = schema.createPureFunction("CalculateBasePrice");
const applyDiscount = schema.createPureFunction("ApplyDiscount");
const calculateTax = schema.createPureFunction("CalculateTax");
const processPayment = schema.createFunction("ProcessPayment");
const sendNotification = schema.createFunction("SendNotification");

// Подключаем схему обработки заказа
schema.wire(orderReceived, "order", validateProducts, "order");
schema.wire(validateProducts, "validatedOrder", checkInventory, "order");

// Параллельные вычисления цены
schema.wire(checkInventory, "availableOrder", calculateBasePrice, "order");
schema.wire(calculateBasePrice, "basePrice", applyDiscount, "basePrice");
schema.wire(orderReceived.instance, "order", applyDiscount, "discountCode"); // Нужно извлечь discountCode из order
schema.wire(applyDiscount, "priceAfterDiscount", calculateTax, "price");
schema.wire(calculateTax, "totalPrice", processPayment, "totalPrice");
schema.wire(orderReceived, "order", processPayment, "orderId"); // Нужно извлечь orderId

// Уведомления
schema.wire(checkInventory, "outOfStock", sendNotification, "start");
schema.wire(processPayment, "success", sendNotification, "start");
schema.wire(processPayment, "failed", sendNotification, "start");

console.log("E-commerce Order Processing System created!");
console.log(
  "Nodes:",
  schema.extract().events.length +
    schema.extract().functions.length +
    schema.extract().pureFunctions.length,
);
