import type { PinInstanceType } from "../enums";

export interface PinInstance {
  readonly nodeUuid: string;
  readonly uuid: string;
  readonly type: PinInstanceType;
  readonly name: string;
}
