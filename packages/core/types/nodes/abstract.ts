import type { NodeType } from "../../enums";
import type { Field } from "../field";
import type { ExecPin, Pin } from "../pin";

export interface AbstractNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
  PinsIn extends Record<string, Pin<DataTypes>>,
  PinsOut extends Record<string, Pin<DataTypes>>,
  ExecPinsIn extends Record<string, ExecPin>,
  ExecPinsOut extends Record<string, ExecPin>
> {
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
