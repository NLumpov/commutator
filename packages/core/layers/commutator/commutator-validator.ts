import { CommonDataType } from "./enums";
import type { Field } from "./types";

export class CommutatorValidator<const DataTypes extends Record<string, Field<DataTypes>> = {}> {
  constructor(private readonly dataTypes: DataTypes) {}

  public hasDataType<const Name extends keyof DataTypes>(name: Name): boolean {
    return name in this.dataTypes;
  }

  public validateFieldValue(field: Field<DataTypes>, value: unknown): boolean {
    const stack: { field: Field<DataTypes>; value: unknown }[] = [{ field, value }];

    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) {
        break;
      }
      const { field: currentField, value: currentValue } = item;

      // null допустим для всех типов
      if (currentValue === null) {
        continue;
      }

      // Проверка для Object
      if (currentField.type === CommonDataType.Object) {
        if (
          typeof currentValue !== "object" ||
          currentValue === null ||
          Array.isArray(currentValue)
        ) {
          return false;
        }
        if (!("properties" in currentField)) {
          return false;
        }
        const obj = currentValue as Record<string, unknown>;
        for (const [key, propertyField] of Object.entries(currentField.properties)) {
          if (!(key in obj)) {
            return false;
          }
          stack.push({ field: propertyField, value: obj[key] });
        }
        continue;
      }

      // Проверка для Array
      if (currentField.type === CommonDataType.Array) {
        if (!Array.isArray(currentValue)) {
          return false;
        }
        if (!("itemType" in currentField)) {
          return false;
        }
        for (const item of currentValue) {
          stack.push({ field: currentField.itemType, value: item });
        }
        continue;
      }

      // Проверка для StringEnum
      if (currentField.type === CommonDataType.StringEnum) {
        if (!("values" in currentField)) {
          return false;
        }
        const stringEnumField = currentField as {
          type: CommonDataType.StringEnum;
          values: string[];
        };
        if (typeof currentValue !== "string" || !stringEnumField.values.includes(currentValue)) {
          return false;
        }
        continue;
      }

      // Проверка для NumberEnum
      if (currentField.type === CommonDataType.NumberEnum) {
        if (!("values" in currentField)) {
          return false;
        }
        const numberEnumField = currentField as {
          type: CommonDataType.NumberEnum;
          values: number[];
        };
        if (typeof currentValue !== "number" || !numberEnumField.values.includes(currentValue)) {
          return false;
        }
        continue;
      }

      // Проверка для простых типов
      if (currentField.type === CommonDataType.String) {
        if (typeof currentValue !== "string") {
          return false;
        }
        continue;
      }

      if (
        currentField.type === CommonDataType.Number ||
        currentField.type === CommonDataType.Date
      ) {
        if (typeof currentValue !== "number") {
          return false;
        }
        continue;
      }

      if (currentField.type === CommonDataType.Boolean) {
        if (typeof currentValue !== "boolean") {
          return false;
        }
        continue;
      }

      if (currentField.type === CommonDataType.Any) {
        continue;
      }

      // Проверка для кастомных типов из DataTypes
      if (typeof currentField.type === "string" && currentField.type in this.dataTypes) {
        const customField = this.dataTypes[currentField.type];
        if (!customField) {
          return false;
        }
        stack.push({ field: customField, value: currentValue });
        continue;
      }

      return false;
    }

    return true;
  }
}
