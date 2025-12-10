import {
  CommonDataType,
  commonDataTypes,
  type ExcludeNonPrimitiveDataTypes,
  type Field,
  type FieldValue,
} from "./data-types";
import { NodeableType, type Nodeable } from "./data-types/nodeable";
import type { StaticGetterNode } from "./nodes";
import { v7 as uuid } from "uuid";

export function createCommutator<
  const Config extends {
    dataTypes: Record<string, Field<Config["dataTypes"]>>;
    preloadedState?: {
      staticGetterNodes: StaticGetterNode<any, Config["dataTypes"]>[];
    };
    onNodeMoved?: (
      node: Nodeable,
      coordinates: { x: number; y: number }
    ) => Promise<void> | void;
  }
>(config: Config) {
  type StaticGetterNodeDataTypes = ExcludeNonPrimitiveDataTypes<
    Config["dataTypes"]
  >;

  const nodes = new Map<string, StaticGetterNode<any, Config["dataTypes"]>>(
    config.preloadedState?.staticGetterNodes.map((node) => [node.uuid, node])
  );

  return {
    changeNodeCoordinates: async (
      uuid: string,
      coordinates: { x: number; y: number }
    ) => {
      const node = nodes.get(uuid);

      if (node) {
        await config.onNodeMoved?.(node, {
          x: coordinates.x,
          y: coordinates.y,
        });

        nodes.set(uuid, {
          ...node,
          x: coordinates.x,
          y: coordinates.y,
        });
      }
    },
    createStaticGetterNode: <
      const Type extends StaticGetterNodeDataTypes
    >(staticGetterConfig: {
      type: Type;
      x?: number;
      y?: number;
    }): StaticGetterNode<Type, Config["dataTypes"]> => {
      const node: StaticGetterNode<Type, Config["dataTypes"]> = {
        uuid: uuid(),
        nodeType: NodeableType.StaticGetter,
        x: staticGetterConfig.x || 0,
        y: staticGetterConfig.y || 0,

        type: staticGetterConfig.type,
        value: null,
      };

      nodes.set(node.uuid, node);

      return node;
    },
  };
}

const commutator = createCommutator({
  dataTypes: {
    ...commonDataTypes,
    Kek: {
      name: "Kek",
      type: CommonDataType.Number,
    },
  },
});

const node = commutator.createStaticGetterNode({
  type: "Kek",
  x: 200,
  y: 100,
});
