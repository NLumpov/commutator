import type { EventNode, Field, FunctionNode, PureFunctionNode, RefNode } from "./types";

export class CommutatorConfig<
  const DataTypes extends Record<string, Field<DataTypes>> = {},
  const Events extends Record<string, EventNode<any, any, any, any, any, any, any, any>> = {},
  const Refs extends Record<string, RefNode<any, any, any, any, any, any, any, any>> = {},
  const PureFunctions extends Record<
    string,
    PureFunctionNode<any, any, any, any, any, any, any, any>
  > = {},
  const Functions extends Record<string, FunctionNode<any, any, any, any, any, any, any, any>> = {},
  const Apis extends Record<string, any> = {},
> {
  constructor(
    public readonly dataTypes: DataTypes,
    public readonly events: Events,
    public readonly refs: Refs,
    public readonly pureFunctions: PureFunctions,
    public readonly functions: Functions,
    public readonly apis: Apis,
  ) {}

  public getNodeConfigByName(name: string) {
    return this.events[name] || this.refs[name] || this.pureFunctions[name] || this.functions[name];
  }
}
