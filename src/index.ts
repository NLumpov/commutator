import { CommonDataType, type Field, type Macros } from "./data-types";
import type { RemoteGetterNode } from "./data-types/remote-getter-node";

type Commutator<
  DataTypes extends Record<string, Field<DataTypes>> = {},
  MacrosConfigurations extends Record<string, any> = {},
  Api extends Record<string, Record<string, any>> = {},
  RemoteGetterNodes extends Record<
    string,
    RemoteGetterNode<Api, DataTypes, any, any>
  > = {}
> = {
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
  ): Commutator<
    DataTypes & { [K in Name]: DataType },
    MacrosConfigurations,
    Api
  >;

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
      HiddenStates,
      SharedStates,
      Consumers
    >
  ): Commutator<
    DataTypes,
    MacrosConfigurations & {
      [K in Name]: Macros<
        Api,
        DataTypes,
        HiddenStates,
        SharedStates,
        Consumers
      >;
    },
    Api,
    RemoteGetterNodes
  >;

  defineApiModule<
    const Name extends string,
    const ApiModule extends Record<string, any>
  >(
    name: Name extends keyof Api ? never : Name,
    apiModule: ApiModule
  ): Commutator<
    DataTypes,
    MacrosConfigurations,
    Api & { [K in Name]: ApiModule },
    RemoteGetterNodes
  >;

  defineRemoteGetterNode<
    const Name extends string,
    const Keys extends Record<string, Field<DataTypes>>,
    const Value extends Field<DataTypes>
  >(
    name: Name extends keyof RemoteGetterNodes ? never : Name,
    remoteGetterNode: RemoteGetterNode<Api, DataTypes, Keys, Value>
  ): Commutator<
    DataTypes,
    MacrosConfigurations,
    Api,
    RemoteGetterNodes & {
      [K in Name]: RemoteGetterNode<Api, DataTypes, Keys, Value>;
    }
  >;
};

export function createCommutator(): Commutator<{}, {}, {}, {}> {
  const dataTypes: Record<string, Field<any>> = {};
  const macros = [];
  const remoteGetterNodes = [];

  return {
    defineDataType(name, dataType) {
      return this;
    },
    defineApiModule(name, apiModule) {
      return this;
    },
    defineMacros(name, macrosConfiguration) {
      return this;
    },
    defineRemoteGetterNode(name, remoteGetterNode) {
      return this;
    },
  };
}

const commutator = createCommutator();

commutator
  .defineDataType("Test1", { type: CommonDataType.String, name: "Test1" })
  .defineDataType("Test2", {
    type: CommonDataType.Object,
    name: "Test",
    properties: { test: { type: "Test1", name: "Field" } },
  })
  .defineDataType("Test3", { type: CommonDataType.String, name: "Test3" })
  .defineDataType("Test", { type: CommonDataType.String, name: "Test4" })
  .defineApiModule("Schedule", {
    async scheduleTrigger(uuid: string, timestamp: number) {
      console.log("scheduled trigger");
    },
    cancelSchedule(uuid: string) {
      console.log("canceled schedule");
    },
  })
  .defineMacros("Test", {
    hiddenStates: {
      isCreated: { type: CommonDataType.Boolean, name: "Создан" },
    },
    sharedStates: {
      user: { type: "Test2", name: "User" },
    },
    consumers: {
      name: { type: CommonDataType.String, name: "Имя" },
    },
    isHandlerHidden: false,
    handler: async ({ self, api }) => {
      api.Schedule.scheduleTrigger(self.uuid, Date.now() + 1000);
      self.sharedStates.user.test;
    },
  });
