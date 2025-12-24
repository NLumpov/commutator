import type { Field } from "@declarations/field";
import type { ExecPin, Pin, PinRecordValue } from "@declarations/pin";
import type { AbstractNode } from "@declarations/nodes";
import type { NodeType } from "@enums/node-type";

export interface PureFunctionNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<
    string,
    AbstractNode<DataTypes, Nodes, Meta, any, any, any, any, any>
  >,
  Meta extends Field<DataTypes> | undefined,
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
  readonly type: NodeType.PureFunction;
  /**
   * Чистые функции не имеют метаданных т.к. они 
   * они не могут сохранять промежуточные значения
   */
  readonly meta: undefined;

  /**
   * Exec в pure-функции вызывается когда срабатывает пулл-стратегия,
   * и требует добавить в стекфрейм результаты её выполнения
   */
  readonly exec: (args: {
    pinsIn: PinRecordValue<PinsIn, DataTypes>;
    pinsOut: PinRecordValue<PinsOut, DataTypes>;
  }) => Promise<void>;
}
