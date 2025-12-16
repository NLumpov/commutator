import type { NodeType } from "@enums/node-type";
import type { Field } from "@declarations/field";

export interface AbstractNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<string, AbstractNode<DataTypes, Nodes, any>>,
  Name extends keyof Nodes
> {
  readonly name: Name;
  readonly type: NodeType;
}
