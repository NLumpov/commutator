import type { CommonDataType, Field } from "../../commutator";
import type { PinInstanceType } from "../enums";

export interface PinInstance<DataTypes extends Record<string, Field<DataTypes>> = any> {
  readonly nodeUuid: string;
  readonly uuid: string;
  readonly type: PinInstanceType;
  name: string;
  pinType:
    | null
    | keyof DataTypes
    | Exclude<
        CommonDataType,
        | CommonDataType.Object
        | CommonDataType.Array
        | CommonDataType.StringEnum
        | CommonDataType.NumberEnum
      >;
}
