import type { NodeType } from "../../enums";
import type { Field } from "../";
import type { AbstractNode } from "./abstract";

export interface EventNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
  Config extends Field<DataTypes> | undefined,
  Apis extends Record<string, any>,
  PinsIn extends Record<string, Field<DataTypes>>,
  PinsOut extends Record<string, Field<DataTypes>>,
  ExecPinsIn extends Record<string, null>,
  ExecPinsOut extends Record<string, null>,
> extends AbstractNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut, Apis> {
  readonly type: NodeType.Event;
}
