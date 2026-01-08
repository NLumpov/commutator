import type { CommonDataType } from "../enums";

export type PrimitiveDataType =
  | CommonDataType.String
  | CommonDataType.Number
  | CommonDataType.Date
  | CommonDataType.Boolean;
