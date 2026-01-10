import { CommonDataType, Commutator } from "@commutator/core";

// Движок аналитики с вычислениями
const commutator = Commutator.initialize()
  .defineDataType("DataPoint", {
    type: CommonDataType.Object,
    properties: {
      metric: { type: CommonDataType.String },
      value: { type: CommonDataType.Number },
      timestamp: { type: CommonDataType.Number },
    },
  })
  .defineEvent("DataPoint", {
    pinsOut: {
      dataPoint: { type: CommonDataType.String }, // JSON DataPoint
    },
    execPinsOut: { next: {} },
  })
  .definePureFunction("CalculateMetrics", {
    pinsIn: {
      dataPoints: { type: CommonDataType.String }, // JSON array
    },
    pinsOut: {
      metrics: { type: CommonDataType.String }, // JSON object
    },
    exec: async ({ pinsIn }) => {
      const points = JSON.parse(pinsIn.dataPoints ?? "[]");
      const values = points.map((p: any) => p.value ?? 0);

      const metrics = {
        count: points.length,
        sum: values.reduce((a: number, b: number) => a + b, 0),
        avg:
          values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0,
        min: values.length > 0 ? Math.min(...values) : 0,
        max: values.length > 0 ? Math.max(...values) : 0,
        stdDev:
          values.length > 1
            ? Math.sqrt(
                values.reduce(
                  (acc: number, v: number) =>
                    acc +
                    (v - values.reduce((a: number, b: number) => a + b, 0) / values.length) ** 2,
                  0,
                ) / values.length,
              )
            : 0,
      };

      return { metrics: JSON.stringify(metrics) };
    },
  })
  .defineFunction("DetectAnomalies", {
    pinsIn: {
      dataPoint: { type: CommonDataType.String },
      metrics: { type: CommonDataType.String },
    },
    pinsOut: {
      isAnomaly: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { normal: {}, anomaly: {} },
    exec: async ({ pinsIn, exec }) => {
      const point = JSON.parse(pinsIn.dataPoint ?? "{}");
      const metrics = JSON.parse(pinsIn.metrics ?? "{}");
      const value = point.value ?? 0;
      const avg = metrics.avg ?? 0;
      const stdDev = metrics.stdDev ?? 0;

      // Аномалия если значение отклоняется более чем на 3 стандартных отклонения
      const isAnomaly = Math.abs(value - avg) > 3 * stdDev && stdDev > 0;

      if (isAnomaly) {
        await exec({
          execPinOut: "anomaly",
          pinsOut: {
            isAnomaly: true,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "normal",
          pinsOut: {
            isAnomaly: false,
          },
          meta: null,
        });
      }
    },
  })
  .definePureFunction("CalculateTrends", {
    pinsIn: {
      dataPoints: { type: CommonDataType.String }, // JSON array
    },
    pinsOut: {
      trend: { type: CommonDataType.String }, // "up", "down", "stable"
      trendValue: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      const points = JSON.parse(pinsIn.dataPoints ?? "[]");
      if (points.length < 2) {
        return { trend: "stable", trendValue: 0 };
      }

      const sorted = points.sort((a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
      const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

      const firstAvg =
        firstHalf.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0) / secondHalf.length;

      const diff = secondAvg - firstAvg;
      const trend = diff > 0.1 ? "up" : diff < -0.1 ? "down" : "stable";

      return { trend, trendValue: diff };
    },
  })
  .definePureFunction("ForecastValues", {
    pinsIn: {
      dataPoints: { type: CommonDataType.String },
      periods: { type: CommonDataType.Number },
    },
    pinsOut: {
      forecast: { type: CommonDataType.String }, // JSON array
    },
    exec: async ({ pinsIn }) => {
      const points = JSON.parse(pinsIn.dataPoints ?? "[]");
      const periods = pinsIn.periods ?? 5;

      if (points.length < 2) {
        return { forecast: JSON.stringify([]) };
      }

      const values = points.map((p: any) => p.value ?? 0);
      const trend = (values[values.length - 1] - values[0]) / values.length;
      const lastValue = values[values.length - 1];

      const forecast = Array.from({ length: periods }, (_, i) => ({
        period: i + 1,
        value: lastValue + trend * (i + 1),
      }));

      return { forecast: JSON.stringify(forecast) };
    },
  })
  .defineFunction("GenerateReport", {
    pinsIn: {
      metrics: { type: CommonDataType.String },
      trends: { type: CommonDataType.String },
      forecast: { type: CommonDataType.String },
    },
    pinsOut: {
      report: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      const report = {
        timestamp: Date.now(),
        metrics: JSON.parse(pinsIn.metrics ?? "{}"),
        trends: JSON.parse(pinsIn.trends ?? "{}"),
        forecast: JSON.parse(pinsIn.forecast ?? "[]"),
      };

      console.log("[GenerateReport]", JSON.stringify(report, null, 2));

      await exec({
        execPinOut: "next",
        pinsOut: {
          report: JSON.stringify(report),
        },
        meta: null,
      });
    },
  })
  .defineFunction("StoreAnalytics", {
    pinsIn: {
      report: { type: CommonDataType.String },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log("[StoreAnalytics] Storing analytics report");
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const dataPoint = schema.createEvent("DataPoint");
const calculateMetrics = schema.createPureFunction("CalculateMetrics");
const detectAnomalies = schema.createFunction("DetectAnomalies");
const calculateTrends = schema.createPureFunction("CalculateTrends");
const forecastValues = schema.createPureFunction("ForecastValues");
const generateReport = schema.createFunction("GenerateReport");
const storeAnalytics = schema.createFunction("StoreAnalytics");

// Подключаем схему аналитики
schema.wire(dataPoint, "dataPoint", calculateMetrics, "dataPoints");
schema.wire(dataPoint, "dataPoint", detectAnomalies, "dataPoint");
schema.wire(calculateMetrics, "metrics", detectAnomalies, "metrics");

schema.wire(dataPoint, "dataPoint", calculateTrends, "dataPoints");
schema.wire(dataPoint, "dataPoint", forecastValues, "dataPoints");

schema.wire(calculateMetrics, "metrics", generateReport, "metrics");
schema.wire(calculateTrends, "trend", generateReport, "trends");
schema.wire(forecastValues, "forecast", generateReport, "forecast");

schema.wire(generateReport, "report", storeAnalytics, "report");
schema.wire(generateReport, "next", storeAnalytics, "start");

console.log("Analytics Calculation Engine created!");
