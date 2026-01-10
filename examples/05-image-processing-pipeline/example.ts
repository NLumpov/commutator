import { CommonDataType, Commutator } from "@commutator/core";

// Конвейер обработки изображений
const commutator = Commutator.initialize()
  .defineDataType("ImageMetadata", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      format: { type: CommonDataType.String },
      width: { type: CommonDataType.Number },
      height: { type: CommonDataType.Number },
      size: { type: CommonDataType.Number },
    },
  })
  .defineEvent("ImageUploaded", {
    pinsOut: {
      imageId: { type: CommonDataType.String },
      metadata: { type: CommonDataType.String }, // JSON ImageMetadata
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("ValidateImage", {
    pinsIn: {
      metadata: { type: CommonDataType.String },
    },
    pinsOut: {
      isValid: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { valid: {}, invalid: {} },
    exec: async ({ pinsIn, exec }) => {
      const metadata = JSON.parse(pinsIn.metadata ?? "{}");
      const isValid =
        metadata.format &&
        ["jpg", "png", "webp"].includes(metadata.format) &&
        metadata.width > 0 &&
        metadata.height > 0 &&
        metadata.size < 10 * 1024 * 1024; // Максимум 10MB

      if (isValid) {
        await exec({
          execPinOut: "valid",
          pinsOut: {
            isValid: true,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "invalid",
          pinsOut: {
            isValid: false,
          },
          meta: null,
        });
      }
    },
  })
  .definePureFunction("ResizeImage", {
    pinsIn: {
      imageId: { type: CommonDataType.String },
      targetWidth: { type: CommonDataType.Number },
      targetHeight: { type: CommonDataType.Number },
    },
    pinsOut: {
      resizedImageId: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      // Симуляция ресайза
      const resizedId = `${pinsIn.imageId}_${pinsIn.targetWidth}x${pinsIn.targetHeight}`;
      return { resizedImageId: resizedId };
    },
  })
  .definePureFunction("ApplyFilter", {
    pinsIn: {
      imageId: { type: CommonDataType.String },
      filterType: { type: CommonDataType.String },
    },
    pinsOut: {
      filteredImageId: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      // Симуляция применения фильтра
      const filteredId = `${pinsIn.imageId}_${pinsIn.filterType}`;
      return { filteredImageId: filteredId };
    },
  })
  .definePureFunction("OptimizeImage", {
    pinsIn: {
      imageId: { type: CommonDataType.String },
      quality: { type: CommonDataType.Number },
    },
    pinsOut: {
      optimizedImageId: { type: CommonDataType.String },
      optimizedSize: { type: CommonDataType.Number },
    },
    exec: async ({ pinsIn }) => {
      // Симуляция оптимизации
      const quality = pinsIn.quality ?? 80;
      const optimizedId = `${pinsIn.imageId}_opt_${quality}`;
      const optimizedSize = Math.floor((1000 * (100 - quality)) / 100); // Уменьшение размера
      return { optimizedImageId: optimizedId, optimizedSize };
    },
  })
  .definePureFunction("GenerateThumbnail", {
    pinsIn: {
      imageId: { type: CommonDataType.String },
    },
    pinsOut: {
      thumbnailId: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      // Симуляция генерации миниатюры
      const thumbnailId = `${pinsIn.imageId}_thumb`;
      return { thumbnailId };
    },
  })
  .defineFunction("SaveProcessedImage", {
    pinsIn: {
      imageId: { type: CommonDataType.String },
      format: { type: CommonDataType.String },
    },
    pinsOut: {
      savedPath: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(`[SaveProcessedImage] Saving ${pinsIn.imageId} as ${pinsIn.format}`);
      await exec({
        execPinOut: "next",
        pinsOut: {
          savedPath: `/images/${pinsIn.imageId}.${pinsIn.format}`,
        },
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const imageUploaded = schema.createEvent("ImageUploaded");
const validateImage = schema.createFunction("ValidateImage");
const resizeImage = schema.createPureFunction("ResizeImage");
const applyFilter = schema.createPureFunction("ApplyFilter");
const optimizeImage = schema.createPureFunction("OptimizeImage");
const generateThumbnail = schema.createPureFunction("GenerateThumbnail");
const saveProcessedImage = schema.createFunction("SaveProcessedImage");

// Конвейер обработки
schema.wire(imageUploaded, "metadata", validateImage, "metadata");
schema.wire(imageUploaded, "next", validateImage, "start");

schema.wire(validateImage, "valid", resizeImage, "imageId");
schema.wire(imageUploaded, "imageId", resizeImage, "imageId");

// Параллельная обработка: ресайз для разных размеров
schema.wire(resizeImage, "resizedImageId", optimizeImage, "imageId");
schema.wire(resizeImage, "resizedImageId", generateThumbnail, "imageId");

// Применение фильтров (условно)
schema.wire(resizeImage, "resizedImageId", applyFilter, "imageId");

schema.wire(optimizeImage, "optimizedImageId", saveProcessedImage, "imageId");
schema.wire(generateThumbnail, "thumbnailId", saveProcessedImage, "imageId");

console.log("Image Processing Pipeline created!");
