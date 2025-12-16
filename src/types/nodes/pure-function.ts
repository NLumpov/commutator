import type { Field } from "@declarations/field";
import type { Pin, PinArrayValue } from "@declarations/pin";
import type { ExecPin } from "@declarations/pin";
import type { AbstractNode } from "@declarations/nodes";
import type { NodeType } from "@enums/node-type";

export interface PureFunctionNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<string, AbstractNode<DataTypes, Nodes, any>>,
  Name extends keyof Nodes,
  PinsIn extends Pin<DataTypes, PinsIn, any>[],
  PinsOut extends Pin<DataTypes, PinsOut, any>[],
  ExecPinsIn extends ExecPin<ExecPinsIn, any>[],
  ExecPinsOut extends ExecPin<ExecPinsOut, any>[]
> extends AbstractNode<DataTypes, Nodes, Name> {
  readonly name: Name;
  readonly type: NodeType.PureFunction;

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

  /** Exec в pure-функции вызывается когда срабатывает пулл-стратегия,
   * и требует добавить в стекфрейм результаты её выполнения
   */
  readonly exec: ({
    pinsIn,
    pinsOut,
    execPinsIn,
    execPinsOut,
  }: {
    pinsIn: PinArrayValue<PinsIn, DataTypes>;
    pinsOut: PinArrayValue<PinsOut, DataTypes>;
    execPinsIn: Record<string, ExecPin<any, any>>;
    execPinsOut: Record<string, ExecPin<any, any>>;
  }) => Promise<void>;
}
