import type { NodeType } from "../../enums";
import type { Field, FieldRecordValues, FieldValue } from "../";
import type { AbstractNode } from "./abstract";

export interface FunctionNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Meta extends Field<DataTypes> | undefined,
  Config extends Field<DataTypes> | undefined,
  Apis extends Record<string, any>,
  PinsIn extends Record<string, Field<DataTypes>>,
  PinsOut extends Record<string, Field<DataTypes>>,
  ExecPinsIn extends Record<string, null>,
  ExecPinsOut extends Record<string, null>,
> extends AbstractNode<DataTypes, Meta, Config, PinsIn, PinsOut, ExecPinsIn, ExecPinsOut, Apis> {
  readonly type: NodeType.Function;

  /**
   * Exec в функции вызывается когда триггерится входной exec-пин.
   * Возвращает значения которые должны отдаваться из пинов на выход.
   * Эти значения кешируются и при попытке их получения берутся из кеша.
   * Если функция ещё не вызывалась то пины на выход будут возвращать null
   */
  readonly exec: (args: {
    pinsIn: FieldRecordValues<PinsIn, DataTypes>;
    execPinsIn: ExecPinsIn;
    execPinsOut: ExecPinsOut;
    meta: Meta extends Field<DataTypes> ? FieldValue<Meta, DataTypes> : never;
    config: Config extends Field<DataTypes> ? FieldValue<Config, DataTypes> : never;
    triggeredExecPinKey: keyof ExecPinsIn;
    exec: (args: {
      meta: Meta extends Field<DataTypes> ? FieldValue<Meta, DataTypes> : never;
      pinsOut: FieldRecordValues<PinsOut, DataTypes>;
      execPinOut: string | null;
    }) => Promise<void>;
    // Переделать апи, надо чтобы была возможность экзекать по очереди 10 раз и тд
  }) => Promise<void>;
}
