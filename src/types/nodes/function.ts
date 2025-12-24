import type { Field, FieldValue } from "@declarations/field";
import type { ExecPin, Pin, PinRecordValue } from "@declarations/pin";
import type { AbstractNode } from "@declarations/nodes";
import type { NodeType } from "@enums/node-type";

export interface FunctionNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<
    string,
    AbstractNode<DataTypes, Nodes, Meta, any, any, any, any, any>
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
  readonly name: Name;
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
