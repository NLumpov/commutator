export { createCommutator } from "./create-commutator";

import { CommonDataType } from "./data-types";
import { createCommutator } from "./create-commutator";
import type { OnlyPrimitiveDataTypes } from "./data-types/only-primitive-data-types";

const commutator = createCommutator()
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
  })
  .defineRemoteGetterNode("Test", {
    keys: {
      id: { type: CommonDataType.Number, name: "ID" },
    },
    value: { type: CommonDataType.Number, name: "ID" },
    get: async ({ self, api }) => {
      const user = await api.Schedule.scheduleTrigger(
        self.uuid,
        Date.now() + 1000
      );

      return 1;
    },
    set: async ({ self, api, value }) => {
      self.keys = value;
    },
  })
  .finalize();

const macros = commutator.createMacros("Test");
const staticGetterNode = commutator.createStaticGetterNode("Test");
const remoteGetterNode = commutator.createRemoteGetterNode("Test");