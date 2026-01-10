import { CommonDataType, Commutator } from "@commutator/core";

// Система умных уведомлений
const commutator = Commutator.initialize()
  .defineDataType("Notification", {
    type: CommonDataType.Object,
    properties: {
      userId: { type: CommonDataType.String },
      type: { type: CommonDataType.String },
      message: { type: CommonDataType.String },
      priority: { type: CommonDataType.Number },
    },
  })
  .defineEvent("NotificationEvent", {
    pinsOut: {
      notification: { type: CommonDataType.String }, // JSON Notification
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("CheckUserPreferences", {
    pinsIn: {
      notification: { type: CommonDataType.String },
    },
    pinsOut: {
      allowed: { type: CommonDataType.Boolean },
      preferredChannel: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { allowed: {}, blocked: {} },
    exec: async ({ pinsIn, exec }) => {
      const notification = JSON.parse(pinsIn.notification ?? "{}");
      // Симуляция проверки настроек
      const allowed = notification.type !== "spam";
      const preferredChannel = notification.priority > 5 ? "push" : "email";

      if (allowed) {
        await exec({
          execPinOut: "allowed",
          pinsOut: {
            allowed: true,
            preferredChannel,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "blocked",
          pinsOut: {
            allowed: false,
            preferredChannel: "",
          },
          meta: null,
        });
      }
    },
  })
  .definePureFunction("DeterminePriority", {
    pinsIn: {
      notification: { type: CommonDataType.String },
    },
    pinsOut: {
      priority: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const notification = JSON.parse(pinsIn.notification ?? "{}");
      let priority = notification.priority ?? 0;

      // Повышаем приоритет для важных типов
      if (notification.type === "urgent") priority = 10;
      else if (notification.type === "important") priority = 7;
      else if (notification.type === "normal") priority = 5;
      else priority = 3;

      return { priority };
    },
  })
  .defineFunction("CheckRateLimit", {
    pinsIn: {
      userId: { type: CommonDataType.String },
    },
    pinsOut: {
      canSend: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { allowed: {}, rateLimited: {} },
    meta: { type: CommonDataType.Number }, // Счетчик уведомлений
    exec: async ({ pinsIn, exec, meta }) => {
      const count = meta ?? 0;
      const canSend = count < 10; // Максимум 10 уведомлений

      if (canSend) {
        await exec({
          execPinOut: "allowed",
          pinsOut: {
            canSend: true,
          },
          meta: count + 1,
        });
      } else {
        await exec({
          execPinOut: "rateLimited",
          pinsOut: {
            canSend: false,
          },
          meta: count,
        });
      }
    },
  })
  .definePureFunction("GroupNotifications", {
    pinsIn: {
      notifications: { type: CommonDataType.String }, // JSON array
    },
    pinsOut: {
      grouped: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      const notifications = JSON.parse(pinsIn.notifications ?? "[]");
      const grouped = notifications.reduce((acc: any, n: any) => {
        const key = `${n.userId}_${n.type}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(n);
        return acc;
      }, {});
      return { grouped: JSON.stringify(grouped) };
    },
  })
  .defineFunction("SelectChannel", {
    pinsIn: {
      notification: { type: CommonDataType.String },
      preferredChannel: { type: CommonDataType.String },
      priority: { type: CommonDataType.Number },
    },
    pinsOut: {
      channel: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { email: {}, push: {}, sms: {} },
    exec: async ({ pinsIn, exec }) => {
      const priority = pinsIn.priority ?? 0;
      let channel = pinsIn.preferredChannel ?? "email";

      // Высокий приоритет = SMS
      if (priority >= 9) channel = "sms";
      else if (priority >= 7) channel = "push";
      else channel = "email";

      await exec({
        execPinOut: channel as "email" | "push" | "sms",
        pinsOut: {
          channel,
        },
        meta: null,
      });
    },
  })
  .defineFunction("SendNotification", {
    pinsIn: {
      notification: { type: CommonDataType.String },
      channel: { type: CommonDataType.String },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      const notification = JSON.parse(pinsIn.notification ?? "{}");
      console.log(`[${pinsIn.channel}] Sending to ${notification.userId}: ${notification.message}`);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const notificationEvent = schema.createEvent("NotificationEvent");
const checkUserPreferences = schema.createFunction("CheckUserPreferences");
const determinePriority = schema.createPureFunction("DeterminePriority");
const checkRateLimit = schema.createFunction("CheckRateLimit");
const groupNotifications = schema.createPureFunction("GroupNotifications");
const selectChannel = schema.createFunction("SelectChannel");
const sendNotification = schema.createFunction("SendNotification");

// Подключаем схему
schema.wire(notificationEvent, "notification", checkUserPreferences, "notification");
schema.wire(notificationEvent, "next", checkUserPreferences, "start");

schema.wire(notificationEvent, "notification", determinePriority, "notification");

schema.wire(checkUserPreferences, "allowed", checkRateLimit, "start");
schema.wire(notificationEvent, "notification", checkRateLimit, "userId"); // Нужно извлечь userId

schema.wire(checkRateLimit, "allowed", selectChannel, "start");
schema.wire(notificationEvent, "notification", selectChannel, "notification");
schema.wire(checkUserPreferences, "preferredChannel", selectChannel, "preferredChannel");
schema.wire(determinePriority, "priority", selectChannel, "priority");

schema.wire(selectChannel, "email", sendNotification, "start");
schema.wire(selectChannel, "push", sendNotification, "start");
schema.wire(selectChannel, "sms", sendNotification, "start");
schema.wire(notificationEvent, "notification", sendNotification, "notification");
schema.wire(selectChannel, "channel", sendNotification, "channel");

console.log("Smart Notification System created!");
