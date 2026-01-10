import { CommonDataType, Commutator } from "@commutator/core";

// Конвейер обработки данных с валидацией
const commutator = Commutator.initialize()
  .defineDataType("DataRecord", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      value: { type: CommonDataType.Number },
      category: { type: CommonDataType.String },
      timestamp: { type: CommonDataType.Number },
    },
  })
  .defineEvent("DataReceived", {
    pinsOut: {
      data: { type: CommonDataType.String }, // JSON массив DataRecord
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("ValidateSchema", {
    pinsIn: {
      data: { type: CommonDataType.String },
    },
    pinsOut: {
      isValid: { type: CommonDataType.Boolean },
      validatedData: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { valid: {}, invalid: {} },
    exec: async ({ pinsIn, exec }) => {
      try {
        const records = JSON.parse(pinsIn.data ?? "[]");
        const isValid =
          Array.isArray(records) && records.every((r: any) => r.id && typeof r.value === "number");

        if (isValid) {
          await exec({
            execPinOut: "valid",
            pinsOut: {
              isValid: true,
              validatedData: pinsIn.data ?? "",
            },
            meta: null,
          });
        } else {
          await exec({
            execPinOut: "invalid",
            pinsOut: {
              isValid: false,
              validatedData: "",
            },
            meta: null,
          });
        }
      } catch {
        await exec({
          execPinOut: "invalid",
          pinsOut: {
            isValid: false,
            validatedData: "",
          },
          meta: null,
        });
      }
    },
  })
  .definePureFunction("NormalizeData", {
    pinsIn: {
      data: { type: CommonDataType.String },
    },
    pinsOut: {
      normalizedData: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      const records = JSON.parse(pinsIn.data ?? "[]");
      const normalized = records.map((r: any) => ({
        ...r,
        value: Math.abs(r.value ?? 0), // Нормализация: только положительные значения
        timestamp: r.timestamp ?? Date.now(),
      }));
      return { normalizedData: JSON.stringify(normalized) };
    },
  })
  .definePureFunction("ApplyFilters", {
    pinsIn: {
      data: { type: CommonDataType.String },
      minValue: { type: CommonDataType.Number },
    },
    pinsOut: {
      filteredData: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      const records = JSON.parse(pinsIn.data ?? "[]");
      const minValue = pinsIn.minValue ?? 0;
      const filtered = records.filter((r: any) => (r.value ?? 0) >= minValue);
      return { filteredData: JSON.stringify(filtered) };
    },
  })
  .definePureFunction("TransformData", {
    pinsIn: {
      data: { type: CommonDataType.String },
    },
    pinsOut: {
      transformedData: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      const records = JSON.parse(pinsIn.data ?? "[]");
      const transformed = records.map((r: any) => ({
        ...r,
        value: (r.value ?? 0) * 1.1, // Применяем коэффициент
        processed: true,
      }));
      return { transformedData: JSON.stringify(transformed) };
    },
  })
  .definePureFunction("AggregateData", {
    pinsIn: {
      data: { type: CommonDataType.String },
    },
    pinsOut: {
      aggregatedData: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      const records = JSON.parse(pinsIn.data ?? "[]");
      const grouped = records.reduce((acc: any, r: any) => {
        const category = r.category ?? "unknown";
        if (!acc[category]) {
          acc[category] = { count: 0, sum: 0 };
        }
        acc[category].count++;
        acc[category].sum += r.value ?? 0;
        return acc;
      }, {});
      return { aggregatedData: JSON.stringify(grouped) };
    },
  })
  .definePureFunction("CalculateStatistics", {
    pinsIn: {
      data: { type: CommonDataType.String },
    },
    pinsOut: {
      statistics: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      const records = JSON.parse(pinsIn.data ?? "[]");
      const values = records.map((r: any) => r.value ?? 0);
      const sum = values.reduce((a: number, b: number) => a + b, 0);
      const avg = values.length > 0 ? sum / values.length : 0;
      const max = Math.max(...values, 0);
      const min = Math.min(...values, 0);

      return {
        statistics: JSON.stringify({ sum, avg, max, min, count: values.length }),
      };
    },
  })
  .defineFunction("SaveResults", {
    pinsIn: {
      data: { type: CommonDataType.String },
      statistics: { type: CommonDataType.String },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log("[SaveResults] Data:", pinsIn.data);
      console.log("[SaveResults] Statistics:", pinsIn.statistics);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const dataReceived = schema.createEvent("DataReceived");
const validateSchema = schema.createFunction("ValidateSchema");
const normalizeData = schema.createPureFunction("NormalizeData");
const applyFilters = schema.createPureFunction("ApplyFilters");
const transformData = schema.createPureFunction("TransformData");
const aggregateData = schema.createPureFunction("AggregateData");
const calculateStatistics = schema.createPureFunction("CalculateStatistics");
const saveResults = schema.createFunction("SaveResults");

// Конвейер обработки
schema.wire(dataReceived, "data", validateSchema, "data");
schema.wire(dataReceived, "next", validateSchema, "start");

schema.wire(validateSchema, "validatedData", normalizeData, "data");
schema.wire(validateSchema, "valid", normalizeData, "data"); // Только если валидно

schema.wire(normalizeData, "normalizedData", applyFilters, "data");
// Можно добавить динамический пин для minValue
schema.wire(normalizeData, "normalizedData", transformData, "data");

schema.wire(transformData, "transformedData", aggregateData, "data");
schema.wire(transformData, "transformedData", calculateStatistics, "data");

schema.wire(aggregateData, "aggregatedData", saveResults, "data");
schema.wire(calculateStatistics, "statistics", saveResults, "statistics");
// Нужно добавить exec пин для saveResults

console.log("Data Pipeline with Validation created!");
