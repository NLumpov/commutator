import type { Field, FieldValue } from "../field";
import type { ExecPin, Pin, PinRecordValue } from "../pin";
import type { AbstractNode } from "./abstract";
import type { NodeType } from "../../enums";

export interface FunctionNode<
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
  readonly type: NodeType.Function;

  /**
   * Exec в функции вызывается когда триггерится входной exec-пин.
   * Возвращает значения которые должны отдаваться из пинов на выход.
   * Эти значения кешируются и при попытке их получения берутся из кеша.
   * Если функция ещё не вызывалась то пины на выход будут возвращать null
   */
  readonly exec: (args: {
    pinsIn: PinRecordValue<PinsIn, DataTypes>;
    pinsOut: PinRecordValue<PinsOut, DataTypes>;
    execPinsIn: ExecPinsIn;
    execPinsOut: ExecPinsOut;
    triggeredExecPinKey: keyof ExecPinsIn;
    meta: FieldValue<Meta, DataTypes>;
  }) => Promise<PinRecordValue<PinsOut, DataTypes>>;
}
