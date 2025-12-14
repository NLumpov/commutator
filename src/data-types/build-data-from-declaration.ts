import { CommonDataType } from "./common-data-type.enum";
import type { Field, FieldValue } from "./field";

export function buildDataFromDeclaration<
  const DataTypes extends Record<string, Field<DataTypes>>,
  const Data extends Field<DataTypes>
>(dataTypes: DataTypes, declaration: Data): FieldValue<Data, DataTypes> {
  if (
    declaration.type === CommonDataType.Object &&
    "properties" in declaration
  ) {
    const result: Record<string, any> = {};
    for (const [key, field] of Object.entries(declaration.properties)) {
      result[key] = buildDataFromDeclaration(
        dataTypes,
        field as Field<DataTypes>
      );
    }
    return result as FieldValue<Data, DataTypes>;
  }

  if (declaration.type === CommonDataType.Array) {
    return [] as FieldValue<Data, DataTypes>;
  }

  if (
    declaration.type === CommonDataType.StringEnum ||
    declaration.type === CommonDataType.NumberEnum
  ) {
    return null as FieldValue<Data, DataTypes>;
  }

  if (declaration.type in dataTypes) {
    return buildDataFromDeclaration(
      dataTypes,
      dataTypes[declaration.type as keyof DataTypes]
    ) as FieldValue<Data, DataTypes>;
  }

  return null as FieldValue<Data, DataTypes>;
}

export function buildDataFromDeclarations<
  const DataTypes extends Record<string, Field<DataTypes>>,
  const Data extends Field<DataTypes>
>(
  dataTypes: DataTypes,
  declarations: Record<string, Data>
): Record<string, FieldValue<Data, DataTypes>> {
  return Object.fromEntries(
    Object.entries(declarations).map(([key, declaration]) => [
      key,
      buildDataFromDeclaration(dataTypes, declaration),
    ])
  );
}
