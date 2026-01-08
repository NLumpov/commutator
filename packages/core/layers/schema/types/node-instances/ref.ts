import type { NodeType } from "../../../commutator";
import type { AbstractNodeInstance } from "./abstract";

export interface RefNodeInstance<Name extends string | number | symbol>
  extends AbstractNodeInstance<Name> {
  readonly type: NodeType.Ref;
}
