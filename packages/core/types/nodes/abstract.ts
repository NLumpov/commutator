import type { NodeType } from "../../enums";
import type { Field } from "../field";
import type { ExecPin, Pin } from "../pin";

type AbstractNodeApi = {
  addPinIn: (key: string) => void;
  removePinIn: (key: string) => void;
  addPinOut: (key: string) => void;
  removePinOut: (key: string) => void;
  addExecPinIn: (key: string) => void;
  removeExecPinIn: (key: string) => void;
  addExecPinOut: (key: string) => void;
  removeExecPinOut: (key: string) => void;
};

type PinEventArgs = {
  key: string;
  api: AbstractNodeApi;
};

export interface AbstractNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
  Config extends Field<DataTypes> | undefined,
  PinsIn extends Record<string, Pin<DataTypes>>,
  PinsOut extends Record<string, Pin<DataTypes>>,
  ExecPinsIn extends Record<string, ExecPin>,
  ExecPinsOut extends Record<string, ExecPin>,
> {
  readonly type: NodeType;

  readonly meta?: Meta;
  readonly config?: Config;

  readonly pinsIn: PinsIn;
  readonly canAddPinIn: boolean;
  onPinInAdded?: (args: PinEventArgs) => void;
  onPinInConnected?: (args: PinEventArgs) => void;
  onPinInDisconnected?: (args: PinEventArgs) => void;

  readonly pinsOut: PinsOut;
  readonly canAddPinOut: boolean;
  onPinOutAdded?: (args: PinEventArgs) => void;
  onPinOutConnected?: (args: PinEventArgs) => void;
  onPinOutDisconnected?: (args: PinEventArgs) => void;

  readonly execPinsIn: ExecPinsIn;
  readonly canAddExecPinIn: boolean;
  onExecPinInAdded?: (args: PinEventArgs) => void;
  onExecPinInConnected?: (args: PinEventArgs) => void;
  onExecPinInDisconnected?: (args: PinEventArgs) => void;

  readonly execPinsOut: ExecPinsOut;
  readonly canAddExecPinOut: boolean;
  onExecPinOutAdded?: (args: PinEventArgs) => void;
  onExecPinOutConnected?: (args: PinEventArgs) => void;
  onExecPinOutDisconnected?: (args: PinEventArgs) => void;
}
