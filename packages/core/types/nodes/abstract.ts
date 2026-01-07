import type { NodeType } from "../../enums";
import type { Field } from "../field";
import type { NodeCallbackContext } from "../node-callback-context";
import type { ExecPin, Pin } from "../pin";

export interface AbstractNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
  Config extends Field<DataTypes> | undefined,
  PinsIn extends Record<string, Pin<DataTypes>>,
  PinsOut extends Record<string, Pin<DataTypes>>,
  ExecPinsIn extends Record<string, ExecPin>,
  ExecPinsOut extends Record<string, ExecPin>,
  Apis extends Record<string, any>,
> {
  readonly type: NodeType;

  readonly meta?: Meta;
  readonly config?: Config;

  readonly pinsIn: PinsIn;
  readonly canAddPinIn: boolean;

  readonly pinsOut: PinsOut;
  readonly canAddPinOut: boolean;

  readonly execPinsIn: ExecPinsIn;
  readonly canAddExecPinIn: boolean;

  readonly execPinsOut: ExecPinsOut;
  readonly canAddExecPinOut: boolean;

  /**
   * Callback вызывается при изменении конфигурации ноды
   */
  readonly onConfigChange?: (args: NodeCallbackContext<DataTypes, Config, Apis>) => void;
}
