import type { CommutatorSchema } from "./commutator-schema";
import type { AbstractNodeInstance } from "./types/node-instances/abstract";

/** Node fields and fluent wiring on one object; Schema owns the stored node data. */
export class FluentNodeBuilder<
  const DataTypes extends Record<string, any> = {},
  const Events extends Record<string, any> = {},
  const Refs extends Record<string, any> = {},
  const PureFunctions extends Record<string, any> = {},
  const Functions extends Record<string, any> = {},
  const Apis extends Record<string, any> = {},
  NodeInstance extends AbstractNodeInstance<any> = AbstractNodeInstance<any>,
> implements AbstractNodeInstance<NodeInstance["name"]>
{
  readonly uuid: string;
  readonly type: NodeInstance["type"];
  readonly name: NodeInstance["name"];
  readonly config: NodeInstance["config"];
  x: number;
  y: number;

  readonly #schema: CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis>;

  constructor(
    schema: CommutatorSchema<DataTypes, Events, Refs, PureFunctions, Functions, Apis>,
    node: NodeInstance,
  ) {
    this.#schema = schema;
    this.uuid = node.uuid;
    this.type = node.type;
    this.name = node.name;
    this.config = node.config;
    this.x = node.x;
    this.y = node.y;
  }

  /**
   * Подключить пин этой ноды к другому пину
   */
  wire(
    fromPinName: string,
    toNodeUuid: string | FluentNodeBuilder<any, any, any, any, any, any, any>,
    toPinName: string,
  ): FluentNodeBuilder<DataTypes, Events, Refs, PureFunctions, Functions, Apis, NodeInstance> {
    const resolvedToNodeUuid = typeof toNodeUuid === "string" ? toNodeUuid : toNodeUuid.uuid;
    this.#schema.wire({
      from: { node: this.uuid, pin: fromPinName },
      to: { node: resolvedToNodeUuid, pin: toPinName },
    });
    return this;
  }
}
