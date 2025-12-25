import type { NodeType } from "../../enums";
import type { Field } from "../field";
import type { ExecPin, Pin } from "../pin";
import type { AbstractNode } from "./abstract";

export interface EventNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes>,
  PinsIn extends Record<string, Pin<DataTypes>>,
  PinsOut extends Record<string, Pin<DataTypes>>,
  ExecPinsIn extends Record<string, ExecPin>,
  ExecPinsOut extends Record<string, ExecPin>
> extends AbstractNode<
    DataTypes,
    Meta,
    PinsIn,
    PinsOut,
    ExecPinsIn,
    ExecPinsOut
  > {
  readonly type: NodeType.Event;
}
