import type { Field } from "../field";
import type { ExecPin, Pin, PinRecordValue } from "../pin";
import type { AbstractNode } from "./abstract";
import type { NodeType } from "../../enums";

export interface PureFunctionNode<
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
