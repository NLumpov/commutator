import type { NodeType } from "@enums/node-type";
import type { Field } from "@declarations/field";
import type { ExecPin, Pin } from "@declarations/pin";
import type { AbstractNode } from "@declarations/nodes";

export interface EventNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<
    string,
    AbstractNode<
      DataTypes,
      Nodes,
      Meta,
      Name,
      PinsIn,
      PinsOut,
      ExecPinsIn,
      ExecPinsOut
    >
  >,
  Meta extends Field<DataTypes>,
  Name extends keyof Nodes,
  PinsIn extends Record<string, Pin<DataTypes>>,
  PinsOut extends Record<string, Pin<DataTypes>>,
  ExecPinsIn extends Record<string, ExecPin>,
  ExecPinsOut extends Record<string, ExecPin>
> extends AbstractNode<
    DataTypes,
    Nodes,
    Meta,
    Name,
    PinsIn,
    PinsOut,
    ExecPinsIn,
    ExecPinsOut
  > {
  readonly type: NodeType.Event;
}
