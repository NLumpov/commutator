import { CommonDataType, type Field } from "../commutator";
import { snapshotError } from "./snapshot-json";

/** Only library descriptor names are optional; user JSON stays untouched. */
export function snapshotField<DataTypes extends Record<string, Field<DataTypes>>>(
  field: Field<DataTypes> | null | undefined,
  ancestors = new Set<object>(),
): unknown {
  if (field == null) return null;
  if (ancestors.has(field)) return snapshotError("cyclic field descriptor");
  ancestors.add(field);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(field);
    if (descriptors.name && "value" in descriptors.name && descriptors.name.value === undefined) {
      delete descriptors.name;
    }
    // Retain descriptors/prototypes so the strict JSON copy still rejects accessors,
    // hidden properties and custom objects instead of normalizing them away.
    if (
      descriptors.type?.value === CommonDataType.Object &&
      descriptors.properties &&
      "value" in descriptors.properties
    ) {
      const original = descriptors.properties.value;
      const properties = Object.getOwnPropertyDescriptors(original);
      for (const descriptor of Object.values(properties)) {
        if ("value" in descriptor) descriptor.value = snapshotField(descriptor.value, ancestors);
      }
      if (descriptors.properties && "value" in descriptors.properties) {
        descriptors.properties.value = Object.create(Object.getPrototypeOf(original), properties);
      }
    }
    if (descriptors.type?.value === CommonDataType.Array) {
      if (descriptors.itemType && "value" in descriptors.itemType) {
        descriptors.itemType.value = snapshotField(descriptors.itemType.value, ancestors);
      }
    }
    return Object.create(Object.getPrototypeOf(field), descriptors);
  } finally {
    ancestors.delete(field);
  }
}
