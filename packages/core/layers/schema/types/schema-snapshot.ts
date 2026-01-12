import type { AbstractNodeInstance } from "./node-instances";
import type { PinInstance } from "./pin-instance";
import type { Wire } from "./wire";

export interface SchemaSnapshot {
  nodes: AbstractNodeInstance<string>[];
  pinInstances: PinInstance[];
  wires: Wire[];
}
