import { CommonDataType } from "./common-data-type.enum";

export const commonDataTypes = {
  String: {
    name: "Строка",
    type: CommonDataType.String,
  },
  Number: {
    name: "Число",
    type: CommonDataType.Number,
  },
  Date: {
    name: "Дата",
    type: CommonDataType.Date,
  },
  Boolean: {
    name: "Да/Нет",
    type: CommonDataType.Boolean,
  },
  Object: {
    name: "Сущность",
    type: CommonDataType.Object,
  },
  Array: {
    name: "Список",
    type: CommonDataType.Array,
  },
  StringEnum: {
    name: "Выбор строки",
    type: CommonDataType.StringEnum,
  },
  NumberEnum: {
    name: "Выбор числа",
    type: CommonDataType.NumberEnum,
  },
} as const;
