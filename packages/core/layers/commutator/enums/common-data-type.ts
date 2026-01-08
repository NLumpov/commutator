import type { PrimitiveDataType } from "../types";

export enum CommonDataType {
  Any = "Any",
  String = "String",
  Number = "Number",
  Date = "Date",
  Boolean = "Boolean",
  Object = "Object",
  Array = "Array",
  StringEnum = "StringEnum",
  NumberEnum = "NumberEnum",
}

export const PrimitiveDataTypes = [
  CommonDataType.String,
  CommonDataType.Number,
  CommonDataType.Date,
  CommonDataType.Boolean,
] as const satisfies PrimitiveDataType[];
