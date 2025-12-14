import { v7 as uuid } from "uuid";
import {
  type Field,
  type FieldRecordValues,
  type FieldValue,
  type Macros,
  type MacrosInstance,
  type RemoteGetterNode,
  type RemoteGetterNodeInstance,
  type StaticGetterNodeInstance,
} from "./data-types";
import { NodeType } from "./data-types/node-type";
import {
  buildDataFromDeclaration,
  buildDataFromDeclarations,
} from "./data-types/build-data-from-declaration";
import type { OnlyPrimitiveDataTypes } from "./data-types/only-primitive-data-types";
import type { NonNeverKeyof } from "./data-types/non-never-keys";

export function getConfiguredCommutator<
  const DataTypes extends Record<string, Field<DataTypes>> = {},
  const Api extends Record<string, Record<string, any>> = {},
  const MacrosConfigurations extends Record<
    string,
    Macros<Api, DataTypes, any, any, any, any>
  > = {},
  const RemoteGetterNodes extends Record<
    string,
    RemoteGetterNode<Api, DataTypes, any, any, any>
  > = {}
>(state: {
  dataTypes: DataTypes;
  apiModules: Api;
  macros: MacrosConfigurations;
  remoteGetterNodes: RemoteGetterNodes;
}) {
  return {
    createMacros<const Name extends keyof MacrosConfigurations>(
      name: Name,
      initialCoordinates: { x: number; y: number } = { x: 0, y: 0 }
    ): MacrosInstance<
      DataTypes,
      Name extends string ? Name : never,
      MacrosConfigurations[Name]["hiddenStates"],
      MacrosConfigurations[Name]["sharedStates"],
      MacrosConfigurations[Name]["consumers"]
    > {
      const config = state.macros[name]!;

      return {
        uuid: uuid(),
        x: initialCoordinates.x,
        y: initialCoordinates.y,
        type: NodeType.Macros,
        name: name as Name extends string ? Name : never,
        hiddenStates: buildDataFromDeclarations(
          state.dataTypes,
          config.hiddenStates
        ) as FieldRecordValues<
          MacrosConfigurations[Name]["hiddenStates"],
          DataTypes
        >,
        sharedStates: buildDataFromDeclarations(
          state.dataTypes,
          config.sharedStates
        ) as FieldRecordValues<
          MacrosConfigurations[Name]["sharedStates"],
          DataTypes
        >,
        consumers: buildDataFromDeclarations(
          state.dataTypes,
          config.consumers
        ) as FieldRecordValues<
          MacrosConfigurations[Name]["consumers"],
          DataTypes
        >,
      };
    },
    createStaticGetterNode<
      const Name extends NonNeverKeyof<OnlyPrimitiveDataTypes<DataTypes>>
    >(
      name: Name,
      initialCoordinates: { x: number; y: number } = { x: 0, y: 0 }
    ): StaticGetterNodeInstance<DataTypes, Name, DataTypes[Name]> {
      const config = state.dataTypes[name]!;

      return {
        uuid: uuid(),
        x: initialCoordinates.x,
        y: initialCoordinates.y,
        type: NodeType.StaticGetter,
        name: name as Name extends string ? Name : never,
        value: buildDataFromDeclaration(state.dataTypes, config) as FieldValue<
          DataTypes[Name],
          DataTypes
        >,
      };
    },
    createRemoteGetterNode<const Name extends keyof RemoteGetterNodes>(
      name: Name,
      initialCoordinates: { x: number; y: number } = { x: 0, y: 0 }
    ): RemoteGetterNodeInstance<
      DataTypes,
      Name extends string ? Name : never,
      RemoteGetterNodes[Name]["keys"],
      RemoteGetterNodes[Name]["value"]
    > {
      const config = state.remoteGetterNodes[name]!;

      return {
        uuid: uuid(),
        x: initialCoordinates.x,
        y: initialCoordinates.y,
        type: NodeType.RemoteGetter,
        name: name as Name extends string ? Name : never,
        keys: buildDataFromDeclarations(
          state.dataTypes,
          config.keys
        ) as FieldRecordValues<RemoteGetterNodes[Name]["keys"], DataTypes>,
        value: buildDataFromDeclaration(
          state.dataTypes,
          config.value
        ) as FieldValue<RemoteGetterNodes[Name]["value"], DataTypes>,
      };
    },
  };
}
