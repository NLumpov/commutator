import type { NodeType } from "../../../commutator";

export interface AbstractNodeInstance<Name extends string | number | symbol> {
  readonly uuid: string;
  readonly type: NodeType;
  readonly name: Name;
  readonly config?: unknown | undefined;
  x: number;
  y: number;
}
