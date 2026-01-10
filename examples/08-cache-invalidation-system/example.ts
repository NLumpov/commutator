import { CommonDataType, Commutator } from "@commutator/core";

// Система кеширования с инвалидацией
const commutator = Commutator.initialize()
  .defineDataType("CacheEntry", {
    type: CommonDataType.Object,
    properties: {
      key: { type: CommonDataType.String },
      tags: { type: CommonDataType.Array, itemType: { type: CommonDataType.String } },
      dependencies: { type: CommonDataType.Array, itemType: { type: CommonDataType.String } },
      ttl: { type: CommonDataType.Number },
    },
  })
  .defineEvent("DataUpdated", {
    pinsOut: {
      dataKey: { type: CommonDataType.String },
      tags: { type: CommonDataType.String }, // JSON array
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("FindCacheDependencies", {
    pinsIn: {
      dataKey: { type: CommonDataType.String },
      tags: { type: CommonDataType.String },
    },
    pinsOut: {
      dependentKeys: { type: CommonDataType.String }, // JSON array
    },
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция поиска зависимостей
      const tags = JSON.parse(pinsIn.tags ?? "[]");
      const dependentKeys = [
        pinsIn.dataKey,
        ...tags.map((tag: string) => `tag_${tag}`),
        `dep_${pinsIn.dataKey}`,
      ];

      await exec({
        execPinOut: "next",
        pinsOut: {
          dependentKeys: JSON.stringify(dependentKeys),
        },
        meta: null,
      });
    },
  })
  .definePureFunction("CheckCacheValidity", {
    pinsIn: {
      cacheKey: { type: CommonDataType.String },
      ttl: { type: CommonDataType.Number },
      lastUpdated: { type: CommonDataType.Number },
    },
    pinsOut: {
      isValid: { type: CommonDataType.Boolean },
    },
    exec: async ({ pinsIn }) => {
      const now = Date.now();
      const lastUpdated = pinsIn.lastUpdated ?? 0;
      const ttl = pinsIn.ttl ?? 3600000; // 1 час по умолчанию
      const isValid = now - lastUpdated < ttl;
      return { isValid };
    },
  })
  .defineFunction("InvalidateCache", {
    pinsIn: {
      cacheKey: { type: CommonDataType.String },
    },
    pinsOut: {
      invalidated: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(`[InvalidateCache] Invalidating cache: ${pinsIn.cacheKey}`);
      await exec({
        execPinOut: "next",
        pinsOut: {
          invalidated: true,
        },
        meta: null,
      });
    },
  })
  .defineFunction("RefreshCache", {
    pinsIn: {
      cacheKey: { type: CommonDataType.String },
      strategy: { type: CommonDataType.String }, // "lazy" or "eager"
    },
    pinsOut: {
      refreshed: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      const strategy = pinsIn.strategy ?? "lazy";
      console.log(`[RefreshCache] Refreshing ${pinsIn.cacheKey} with strategy: ${strategy}`);

      await exec({
        execPinOut: "next",
        pinsOut: {
          refreshed: true,
        },
        meta: null,
      });
    },
  })
  .defineFunction("UpdateDependentCaches", {
    pinsIn: {
      dependentKeys: { type: CommonDataType.String }, // JSON array
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      const keys = JSON.parse(pinsIn.dependentKeys ?? "[]");
      console.log(`[UpdateDependentCaches] Updating ${keys.length} dependent caches`);

      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const dataUpdated = schema.createEvent("DataUpdated");
const findCacheDependencies = schema.createFunction("FindCacheDependencies");
const checkCacheValidity = schema.createPureFunction("CheckCacheValidity");
const invalidateCache = schema.createFunction("InvalidateCache");
const refreshCache = schema.createFunction("RefreshCache");
const updateDependentCaches = schema.createFunction("UpdateDependentCaches");

// Подключаем схему инвалидации
schema.wire(dataUpdated, "dataKey", findCacheDependencies, "dataKey");
schema.wire(dataUpdated, "tags", findCacheDependencies, "tags");
schema.wire(dataUpdated, "next", findCacheDependencies, "start");

schema.wire(findCacheDependencies, "dependentKeys", checkCacheValidity, "cacheKey"); // Нужно обработать массив
schema.wire(findCacheDependencies, "dependentKeys", invalidateCache, "cacheKey");

schema.wire(invalidateCache, "invalidated", refreshCache, "start");
schema.wire(invalidateCache, "cacheKey", refreshCache, "cacheKey");

schema.wire(findCacheDependencies, "dependentKeys", updateDependentCaches, "dependentKeys");
schema.wire(invalidateCache, "next", updateDependentCaches, "start");

console.log("Cache Invalidation System created!");
