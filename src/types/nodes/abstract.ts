import type { NodeType } from "@enums/node-type";
import type { Field } from "@declarations/field";

export interface AbstractNode<
  DataTypes extends Record<string, Field<DataTypes>>,
  Nodes extends Record<string, AbstractNode<DataTypes, Nodes, Meta, any>>,
  Meta extends Field<DataTypes>,
  Name extends keyof Nodes
> {
  readonly name: Name;
  readonly type: NodeType;
  /**
   * Метаданные узла, в которые можно заперсистить промежуточное значение,
   * а потом вытащить его при следующем запуске графа
   */
  readonly meta: Meta;
}

export type ExtendAbstractNodes<
  DataTypes extends Record<string, Field<DataTypes>>,
  Extension extends Record<string, Field<DataTypes>>,
  Nodes extends Record<string, AbstractNode<DataTypes, Nodes, any, any>>,
> = Nodes & {
  [K in keyof Nodes]: AbstractNode<
    DataTypes & Extension,
    Nodes,
    any,
    any
  >;
};