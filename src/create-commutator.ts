import { getConfiguredCommutator } from "./get-configured-commutator";
import {
  type CommonDataType,
  type Field,
  type Macros,
  type RemoteGetterNode,
} from "./data-types";

export function createCommutator<
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
>(state?: {
  dataTypes: DataTypes;
  apiModules: Api;
  macros: MacrosConfigurations;
  remoteGetterNodes: RemoteGetterNodes;
}) {
  const currentState = state || {
    dataTypes: {} as DataTypes,
    apiModules: {} as Api,
    macros: {} as MacrosConfigurations,
    remoteGetterNodes: {} as RemoteGetterNodes,
  };

  return {
    defineDataType<
      const Name extends string,
      const DataType extends Field<DataTypes>
    >(
      name: Name extends keyof DataTypes | keyof typeof CommonDataType
        ? never
        : Name,
      dataType: Name extends keyof DataTypes | keyof typeof CommonDataType
        ? never
        : DataType
    ) {
      return createCommutator<
        DataTypes & { [K in Name]: DataType },
        Api,
        MacrosConfigurations,
        {
          [K in keyof RemoteGetterNodes]: RemoteGetterNode<
            Api,
            DataTypes & { [K in Name]: DataType },
            any,
            any,
            any
          >;
        }
      >({
        ...currentState,
        dataTypes: {
          ...currentState.dataTypes,
          [name]: dataType,
        } as DataTypes & { [K in Name]: DataType },
      });
    },

    defineMacros<
      const Name extends string,
      const HiddenStates extends Record<string, Field<DataTypes>>,
      const SharedStates extends Record<string, Field<DataTypes>>,
      const Consumers extends Record<string, Field<DataTypes>>
    >(
      name: Name extends keyof MacrosConfigurations ? never : Name,
      macrosConfiguration: Macros<
        Api,
        DataTypes,
        Name,
        HiddenStates,
        SharedStates,
        Consumers
      >
    ) {
      return createCommutator<
        DataTypes,
        Api,
        MacrosConfigurations & {
          [K in Name]: Macros<
            Api,
            DataTypes,
            Name,
            HiddenStates,
            SharedStates,
            Consumers
          >;
        },
        RemoteGetterNodes
      >({
        ...currentState,
        macros: {
          ...currentState.macros,
          [name]: macrosConfiguration,
        },
      });
    },

    defineApiModule<
      const Name extends string,
      const ApiModule extends Record<string, any>
    >(name: Name extends keyof Api ? never : Name, apiModule: ApiModule) {
      return createCommutator<
        DataTypes,
        Api & { [K in Name]: ApiModule },
        MacrosConfigurations,
        RemoteGetterNodes
      >({
        ...currentState,
        apiModules: {
          ...currentState.apiModules,
          [name]: apiModule,
        },
      });
    },

    defineRemoteGetterNode<
      const Name extends string,
      const Keys extends Record<string, Field<DataTypes>>,
      const Value extends Field<DataTypes>
    >(
      name: Name extends keyof RemoteGetterNodes ? never : Name,
      remoteGetterNode: RemoteGetterNode<Api, DataTypes, Keys, Name, Value>
    ) {
      return createCommutator<
        DataTypes,
        Api,
        MacrosConfigurations,
        RemoteGetterNodes & {
          [K in Name]: RemoteGetterNode<Api, DataTypes, Keys, Name, Value>;
        }
      >({
        ...currentState,
        remoteGetterNodes: {
          ...currentState.remoteGetterNodes,
          [name]: { ...remoteGetterNode },
        },
      });
    },

    finalize() {
      return getConfiguredCommutator<
        DataTypes,
        Api,
        MacrosConfigurations,
        RemoteGetterNodes
      >(currentState);
    },
  };
}
