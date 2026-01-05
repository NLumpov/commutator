import type {
  EventNodeInstance,
  FunctionNodeInstance,
  PureFunctionNodeInstance,
  RefNodeInstance,
} from "./node-instances";
import type { PinInstance } from "./pin-instance";
import type { Wire } from "./wire";

export interface CommutatorInstanceSnapshot {
  events: EventNodeInstance<any>[];
  refs: RefNodeInstance<any>[];
  pureFunctions: PureFunctionNodeInstance<any>[];
  functions: FunctionNodeInstance<any>[];
  pinInstances: PinInstance[];
  wires: Wire[];
}
