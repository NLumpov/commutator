import type { NodeType } from "../../enums";

export interface AbstractNodeInstance<Name extends string | number | symbol> {
  readonly uuid: string;
  readonly type: NodeType;
  readonly name: Name;
  x: number;
  y: number;
}
