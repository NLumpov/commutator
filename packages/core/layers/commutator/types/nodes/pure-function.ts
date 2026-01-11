import type { NodeType } from "../../enums";
import type { Field, FieldRecordValues, FieldValue } from "../";
import type { AbstractNode } from "./abstract";

export interface PureFunctionNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
  Config extends Field<DataTypes> | undefined,
  Apis extends Record<string, any>,
  PinsIn extends Record<string, Field<DataTypes>>,
  PinsOut extends Record<string, Field<DataTypes>>,
  ExecPinsIn extends Record<string, null>,
  ExecPinsOut extends Record<string, null>,
> extends AbstractNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut, Apis> {
  readonly type: NodeType.PureFunction;

  /**
   * Exec в pure-функции вызывается когда срабатывает пулл-стратегия,
   * и требует добавить в стекфрейм результаты её выполнения
   */
  readonly exec: (args: {
    pinsIn: FieldRecordValues<PinsIn, DataTypes>;
    pinsOut: PinsOut;
    config: Config extends Field<DataTypes> ? FieldValue<Config, DataTypes> : never;
  }) => Promise<FieldRecordValues<PinsOut, DataTypes>>;
}
