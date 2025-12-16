import type { NodeType } from "@enums/node-type";
import type { Field } from "@declarations/field";
import type { ExecPin, Pin } from "@declarations/pin";
import type { AbstractNode } from "@declarations/nodes";

export interface EventNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<string, AbstractNode<DataTypes, Nodes, Meta, any>>,
  Meta extends Field<DataTypes>,
  Name extends keyof Nodes,
  PinsIn extends Pin<DataTypes, PinsIn, any>[],
  ExecPinOut extends ExecPin<[ExecPinOut], any>
> extends AbstractNode<DataTypes, Nodes, Meta, Name> {
  readonly type: NodeType.Event;
  readonly pinsIn: PinsIn;
  readonly execPinOut: ExecPinOut;
}
