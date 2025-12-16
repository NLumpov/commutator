import type { Field, FieldValue } from "@declarations/field";
import type { Pin, PinArrayValue } from "@declarations/pin";
import type { ExecPin } from "@declarations/pin";
import type { AbstractNode } from "@declarations/nodes";
import type { NodeType } from "@enums/node-type";

export interface FunctionNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<string, AbstractNode<DataTypes, Nodes, Meta, any>>,
  Meta extends Field<DataTypes>,
  Name extends keyof Nodes,
  PinsIn extends Pin<DataTypes, PinsIn, any>[],
  PinsOut extends Pin<DataTypes, PinsOut, any>[],
  ExecPinsIn extends ExecPin<ExecPinsIn, any>[],
  ExecPinsOut extends ExecPin<ExecPinsOut, any>[]
> extends AbstractNode<DataTypes, Nodes, Meta, Name> {
  readonly name: Name;
  readonly type: NodeType.Function;

  /** Входные пины работают по pull-стратегии вытаскивая и вычисляя данные из прикреплённых значений */
  readonly pinsIn: PinsIn;
  /** Можем ли динамически добавлять пины */
  readonly canAddPinIn: boolean;

  /**
   * Выходные пины просто коннектятся к другим входным пинам с таким же типом данных, при exec'е
   * у следующей функции эти пины служат для вычисления и передачи данных
   */
  readonly pinsOut: PinsOut;
  /** Можем ли динамически добавлять пины на выход */
  readonly canAddPinOut: boolean;

  /** Входные exec-пины коннектятся к выходным и при exec у выходного триггерят функцию */
  readonly execPinsIn: ExecPinsIn;
  /** Можем ли динамически добавлять exec-пины на вход */
  readonly canAddExecPinIn: boolean;

  /**
   * Выходные exec-пины вызываются внутри exec'а, могут вызываться разные
   * в зависимости от ситуации, поэтому их может быть много
   */
  readonly execPinsOut: ExecPinsOut;
  /** Можем ли динамически добавлять exec-пины на выход */
  readonly canAddExecPinOut: boolean;

  /**
   * Exec в функции вызывается когда триггерится входной exec-пин.
   * Возвращает значения которые должны отдаваться из пинов на выход.
   * Эти значения кешируются и при попытке их получения берутся из кеша.
   * Если функция ещё не вызывалась то пины на выход будут возвращать null
   */
  readonly exec: (args: {
    pinsIn: PinArrayValue<PinsIn, DataTypes>;
    pinsOut: PinArrayValue<PinsOut, DataTypes>;
    execPinsIn: Record<string, ExecPin<ExecPinsIn, any>>;
    execPinsOut: Record<string, ExecPin<ExecPinsOut, any>>;
    triggeredExecPin: ExecPin<ExecPinsIn, any>;
    meta: FieldValue<Meta, DataTypes>;
  }) => Promise<PinArrayValue<PinsOut, DataTypes>>;
}

export type ExtendFunctions<
  DataTypes extends Record<string, Field<DataTypes>>,
  Extension extends Record<string, Field<DataTypes>>,
  Nodes extends Record<string, AbstractNode<DataTypes, Nodes, any, any>>,
  Functions extends Record<string, FunctionNode<DataTypes, Nodes, any, any, any, any, any, any>>,
> = Functions & {
  [K in keyof Functions]: FunctionNode<
    DataTypes & Extension,
    Nodes,
    any,
    any,
    any,
    any,
    any,
    any
  >;
};