import type { Field, FieldValue } from "../field";
import type { ExecPin, Pin, PinRecordValue } from "../pin";
import type { AbstractNode } from "./abstract";
import type { NodeType } from "../../enums";

export interface FunctionNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
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
    execPinsIn: ExecPinsIn;
    execPinsOut: ExecPinsOut;
    meta: Meta extends Field<DataTypes> ? FieldValue<Meta, DataTypes> : never;
    triggeredExecPinKey: keyof ExecPinsIn;
    exec: (args: {
      meta: Meta extends Field<DataTypes> ? FieldValue<Meta, DataTypes> : never;
      pinsOut: PinRecordValue<PinsOut, DataTypes>;
      execPinOut: string | null;
    }) => Promise<void>;
    // Переделать апи, надо чтобы была возможность экзекать по очереди 10 раз и тд
  }) => Promise<void>;
}
