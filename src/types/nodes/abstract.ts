import type { NodeType } from "@enums/node-type";
import type { Field } from "@declarations/field";
import type { ExecPin, Pin } from "@declarations/pin";

export interface AbstractNode<
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
  Meta extends Field<DataTypes> | undefined,
  Name extends keyof Nodes,
  PinsIn extends Record<string, Pin<DataTypes>>,
  PinsOut extends Record<string, Pin<DataTypes>>,
  ExecPinsIn extends Record<string, ExecPin>,
  ExecPinsOut extends Record<string, ExecPin>
> {
  readonly name: Name;
  readonly type: NodeType;

  readonly pinsIn: PinsIn;
  readonly canAddPinIn: boolean;

  readonly pinsOut: PinsOut;
  readonly canAddPinOut: boolean;

  readonly execPinsIn: ExecPinsIn;
  readonly canAddExecPinIn: boolean;

  readonly execPinsOut: ExecPinsOut;
  readonly canAddExecPinOut: boolean;

  /**
   * Метаданные узла, в которые можно заперсистить промежуточное значение,
   * а потом вытащить его при следующем запуске графа
   */
  readonly meta?: Meta;
}
