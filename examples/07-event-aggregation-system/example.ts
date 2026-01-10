import { CommonDataType, Commutator } from "@commutator/core";

// Система агрегации событий
const commutator = Commutator.initialize()
  .defineDataType("Event", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      type: { type: CommonDataType.String },
      value: { type: CommonDataType.Number },
      timestamp: { type: CommonDataType.Number },
      category: { type: CommonDataType.String },
    },
  })
  .defineEvent("EventStream", {
    pinsOut: {
      event: { type: CommonDataType.String }, // JSON Event
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("TimeWindowAggregator", {
    pinsIn: {
      event: { type: CommonDataType.String },
      windowSize: { type: CommonDataType.Number }, // в миллисекундах
    },
    pinsOut: {
      aggregatedEvents: { type: CommonDataType.String }, // JSON array
    },
    execPinsIn: { start: {} },
    execPinsOut: { windowComplete: {}, continue: {} },
    meta: { type: CommonDataType.String }, // JSON array накопленных событий
    exec: async ({ pinsIn, exec, meta }) => {
      const events = meta ? JSON.parse(meta) : [];
      const newEvent = JSON.parse(pinsIn.event ?? "{}");
      const windowSize = pinsIn.windowSize ?? 60000; // 1 минута по умолчанию

      events.push(newEvent);

      // Проверяем, заполнено ли временное окно
      if (events.length > 0) {
        const firstTime = events[0].timestamp ?? Date.now();
        const lastTime = newEvent.timestamp ?? Date.now();
        const windowComplete = lastTime - firstTime >= windowSize;

        if (windowComplete) {
          await exec({
            execPinOut: "windowComplete",
            pinsOut: {
              aggregatedEvents: JSON.stringify(events),
            },
            meta: JSON.stringify([]), // Сбрасываем окно
          });
        } else {
          await exec({
            execPinOut: "continue",
            pinsOut: {
              aggregatedEvents: "",
            },
            meta: JSON.stringify(events),
          });
        }
      }
    },
  })
  .definePureFunction("GroupEvents", {
    pinsIn: {
      events: { type: CommonDataType.String }, // JSON array
      groupBy: { type: CommonDataType.String }, // "type", "category", etc.
    },
    pinsOut: {
      grouped: { type: CommonDataType.String }, // JSON object
    },
    exec: async ({ pinsIn }) => {
      const events = JSON.parse(pinsIn.events ?? "[]");
      const groupBy = pinsIn.groupBy ?? "type";

      const grouped = events.reduce((acc: any, event: any) => {
        const key = event[groupBy] ?? "unknown";
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(event);
        return acc;
      }, {});

      return { grouped: JSON.stringify(grouped) };
    },
  })
  .definePureFunction("CalculateMetrics", {
    pinsIn: {
      events: { type: CommonDataType.String }, // JSON array
    },
    pinsOut: {
      metrics: { type: CommonDataType.String }, // JSON object
    },
    exec: async ({ pinsIn }) => {
      const events = JSON.parse(pinsIn.events ?? "[]");
      const values = events.map((e: any) => e.value ?? 0);

      const metrics = {
        count: events.length,
        sum: values.reduce((a: number, b: number) => a + b, 0),
        avg:
          values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0,
        min: values.length > 0 ? Math.min(...values) : 0,
        max: values.length > 0 ? Math.max(...values) : 0,
      };

      return { metrics: JSON.stringify(metrics) };
    },
  })
  .defineFunction("CheckThresholds", {
    pinsIn: {
      metrics: { type: CommonDataType.String }, // JSON object
      threshold: { type: CommonDataType.Number },
    },
    pinsOut: {
      exceeded: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { normal: {}, exceeded: {} },
    exec: async ({ pinsIn, exec }) => {
      const metrics = JSON.parse(pinsIn.metrics ?? "{}");
      const threshold = pinsIn.threshold ?? 100;
      const exceeded = metrics.avg > threshold || metrics.max > threshold * 2;

      if (exceeded) {
        await exec({
          execPinOut: "exceeded",
          pinsOut: {
            exceeded: true,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "normal",
          pinsOut: {
            exceeded: false,
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("TriggerAlert", {
    pinsIn: {
      metrics: { type: CommonDataType.String },
      threshold: { type: CommonDataType.Number },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      const metrics = JSON.parse(pinsIn.metrics ?? "{}");
      console.log(`[Alert] Threshold exceeded! Metrics:`, metrics);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  })
  .defineFunction("StoreAggregatedData", {
    pinsIn: {
      grouped: { type: CommonDataType.String },
      metrics: { type: CommonDataType.String },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log("[StoreAggregatedData] Storing aggregated data");
      console.log("Grouped:", pinsIn.grouped);
      console.log("Metrics:", pinsIn.metrics);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const eventStream = schema.createEvent("EventStream");
const timeWindowAggregator = schema.createFunction("TimeWindowAggregator");
const groupEvents = schema.createPureFunction("GroupEvents");
const calculateMetrics = schema.createPureFunction("CalculateMetrics");
const checkThresholds = schema.createFunction("CheckThresholds");
const triggerAlert = schema.createFunction("TriggerAlert");
const storeAggregatedData = schema.createFunction("StoreAggregatedData");

// Подключаем схему агрегации
schema.wire(eventStream, "event", timeWindowAggregator, "event");
schema.wire(eventStream, "next", timeWindowAggregator, "start");

schema.wire(timeWindowAggregator, "aggregatedEvents", groupEvents, "events");
schema.wire(timeWindowAggregator, "aggregatedEvents", calculateMetrics, "events");

schema.wire(calculateMetrics, "metrics", checkThresholds, "metrics");
schema.wire(checkThresholds, "exceeded", triggerAlert, "start");
schema.wire(calculateMetrics, "metrics", triggerAlert, "metrics");

schema.wire(groupEvents, "grouped", storeAggregatedData, "grouped");
schema.wire(calculateMetrics, "metrics", storeAggregatedData, "metrics");
schema.wire(timeWindowAggregator, "windowComplete", storeAggregatedData, "start");

console.log("Event Aggregation System created!");
