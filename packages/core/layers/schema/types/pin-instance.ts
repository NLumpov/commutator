import type { Field } from "../../commutator";
import type { PinInstanceType } from "../enums";

export interface PinInstance<DataTypes extends Record<string, Field<DataTypes>> = any> {
  readonly nodeUuid: string;
  readonly uuid: string;
  readonly type: PinInstanceType;
  default?: unknown;
  name: string;
  dataType: null | Field<DataTypes>;
}
