import type { NodeType } from "../../enums";
import type { Field, NodeCallbackContext } from "../";

export interface AbstractNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
  Config extends Field<DataTypes> | undefined,
  PinsIn extends Record<string, Field<DataTypes>>,
  PinsOut extends Record<string, Field<DataTypes>>,
  ExecPinsIn extends Record<string, null>,
  ExecPinsOut extends Record<string, null>,
  Apis extends Record<string, any>,
> {
  readonly type: NodeType;

  readonly meta?: Meta;
  readonly config?: Config;

  readonly pinsIn: PinsIn;
  /**
   * Callback вызывается при попытке добавить входной data-пин
   */
  readonly addPinIn?: (args: NodeCallbackContext<DataTypes, Config, Apis>) => void;

  readonly pinsOut: PinsOut;
  /**
   * Callback вызывается при попытке добавить выходной data-пин
   */
  readonly addPinOut?: (args: NodeCallbackContext<DataTypes, Config, Apis>) => void;

  readonly execPinsIn: ExecPinsIn;
  /**
   * Callback вызывается при попытке добавить входной exec-пин
   */
  readonly addExecPinIn?: (args: NodeCallbackContext<DataTypes, Config, Apis>) => void;

  readonly execPinsOut: ExecPinsOut;
  /**
   * Callback вызывается при попытке добавить выходной exec-пин
   */
  readonly addExecPinOut?: (args: NodeCallbackContext<DataTypes, Config, Apis>) => void;

  /**
   * Callback вызывается при изменении конфигурации ноды
   */
  readonly onConfigChange?: (args: NodeCallbackContext<DataTypes, Config, Apis>) => void;
}
