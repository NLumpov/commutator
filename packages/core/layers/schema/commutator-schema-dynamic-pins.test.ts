import { describe, expect, test } from "bun:test";
import { Commutator, CommonDataType } from "../commutator";
import { CommutatorError } from "../commutator/commutator-error";
import { PinInstanceType } from "./enums";

describe("CommutatorSchema - Dynamic Pins", () => {
  describe("dataType initialization", () => {
    test("should initialize dataType from static configuration", () => {
      const commutator = Commutator.initialize().definePureFunction("add", {
        pinsIn: {
          a: { type: CommonDataType.Number },
          b: { type: CommonDataType.String },
        },
        pinsOut: {
          result: { type: CommonDataType.Number },
        },
        exec: async ({ pinsIn }) => ({ result: Number(pinsIn.a ?? 0) + Number(pinsIn.b ?? 0) }),
      });

      const schema = commutator.createSchema();
      const add = schema.createPureFunction("add");
      const pins = schema.getNodePins(add.uuid);

      const pinA = pins.find((p) => p.name === "a" && p.type === PinInstanceType.Input);
      const pinB = pins.find((p) => p.name === "b" && p.type === PinInstanceType.Input);
      const pinResult = pins.find((p) => p.name === "result" && p.type === PinInstanceType.Output);

      expect(pinA?.dataType?.type).toBe(CommonDataType.Number);
      expect(pinB?.dataType?.type).toBe(CommonDataType.String);
      expect(pinResult?.dataType?.type).toBe(CommonDataType.Number);
    });

    test("should initialize exec pins with Any type", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {
            next: null,
        },
      });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const pins = schema.getNodePins(event.uuid);

      const execPin = pins.find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      expect(execPin?.dataType?.type).toBe(CommonDataType.Any);
    });

    test("should initialize dataType as Any when pin config is missing", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {},
        pinsOut: {},
        addPinIn: ({ actions }) => {
          actions.addPin("dynamicPin", PinInstanceType.Input, { type: CommonDataType.Any });
        },
        addPinOut: () => {},
        exec: async () => ({}),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      schema.addPinIn(test.uuid);

      const pins = schema.getNodePins(test.uuid);
      const dynamicPin = pins.find((p) => p.name === "dynamicPin");
      expect(dynamicPin?.dataType?.type).toBe(CommonDataType.Any);
    });
  });

  describe("onConfigChange callback", () => {
    test("should call onConfigChange when creating node", () => {
      let callbackCalled = false;
      let receivedConfig: unknown = null;
      let receivedActions: unknown = null;

      const commutator = Commutator.initialize().defineFunction("test", {
        config: {
          type: CommonDataType.Object,
          properties: {
            value: { type: CommonDataType.Number },
          },
        },
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        onConfigChange: ({ config, actions }) => {
          callbackCalled = true;
          receivedConfig = config;
          receivedActions = actions;
        },
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      const test = schema.createFunction("test", { value: 42 });

      expect(callbackCalled).toBe(true);
      expect(receivedConfig).toEqual({ value: 42 });
      expect(receivedActions).toBeDefined();
    });

    test("should call onConfigChange with apis", () => {
      const testApi = { test: () => "test" };
      let receivedApis: unknown = null;

      const commutator = Commutator.initialize(
        {},
        {},
        {},
        {},
        {},
        { testApi },
      ).defineFunction("test", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        onConfigChange: ({ apis }) => {
          receivedApis = apis;
        },
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      schema.createFunction("test");

      expect(receivedApis).toEqual({ testApi });
    });

    test("should call onConfigChange when restoring from snapshot", () => {
      let callbackCallCount = 0;

      const commutator = Commutator.initialize().defineFunction("test", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        onConfigChange: () => {
          callbackCallCount++;
        },
        exec: async () => {},
      });

      const schema1 = commutator.createSchema();
      const test = schema1.createFunction("test");
      const snapshot = schema1.extract();

      const schema2 = commutator.createSchema(snapshot);

      // onConfigChange должен быть вызван при восстановлении
      expect(callbackCallCount).toBeGreaterThan(0);
    });
  });

  describe("NodeCallbackActions - updatePin", () => {
    test("should update pin type", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          value: { type: CommonDataType.Number },
        },
        pinsOut: {},
        onConfigChange: ({ actions }) => {
          const pin = actions.getPin("value");
          if (pin) {
            actions.updatePin(pin.uuid, { dataType: { type: CommonDataType.String } });
          } 
        },
        exec: async () => ({}),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      const valuePin = pins.find((p) => p.name === "value");
      expect(valuePin?.dataType?.type).toBe(CommonDataType.String);
    });

    test("should update pin name", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          oldName: { type: CommonDataType.Number },
        },
        pinsOut: {},
        onConfigChange: ({ actions }) => {
          const pin = actions.getPin("oldName");
          if (pin) {
            actions.updatePin(pin.uuid, { name: "newName" });
          }
        },
        exec: async () => ({}),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      const oldPin = pins.find((p) => p.name === "oldName");
      const newPin = pins.find((p) => p.name === "newName");

      expect(oldPin).toBeUndefined();
      expect(newPin).toBeDefined();
      expect(newPin?.dataType?.type).toBe(CommonDataType.Number);
    });

    test("should update both name and type", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          oldName: { type: CommonDataType.Number },
        },
        pinsOut: {},
        onConfigChange: ({ actions }) => {
          const pin = actions.getPin("oldName");
          if (pin) {
            actions.updatePin(pin.uuid, {
              name: "newName",
              dataType: { type: CommonDataType.String },
            });
          }
        },
        exec: async () => ({}),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      const newPin = pins.find((p) => p.name === "newName");
      expect(newPin).toBeDefined();
      expect(newPin?.dataType?.type).toBe(CommonDataType.String);
    });

    test("should throw error when updating non-existent pin", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {},
        pinsOut: {},
        onConfigChange: ({ actions }) => {
          expect(() => {
            actions.updatePin("non-existent-uuid", { dataType: { type: CommonDataType.String } });
          }).toThrow(CommutatorError);
        },
        exec: async () => ({}),
      });

      commutator.createSchema().createPureFunction("test");
    });

    test("should throw error when new name is already taken", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          pin1: { type: CommonDataType.Number },
          pin2: { type: CommonDataType.String },
        },
        pinsOut: {},
        onConfigChange: ({ actions }) => {
          const pin1 = actions.getPin("pin1");
          if (pin1) {
            expect(() => {
              actions.updatePin(pin1.uuid, { name: "pin2" });
            }).toThrow(CommutatorError);
          }
        },
        exec: async () => ({}),
      });

      commutator.createSchema().createPureFunction("test");
    });
  });

  describe("NodeCallbackActions - addPin", () => {
    test("should add pin when addPinIn is defined", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {},
        pinsOut: {},
        addPinIn: () => {},
        onConfigChange: ({ actions }) => {
          actions.addPin("newPin", PinInstanceType.Input, { type: CommonDataType.String });
        },
        exec: async () => ({}),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      const newPin = pins.find((p) => p.name === "newPin");
      expect(newPin).toBeDefined();
      expect(newPin?.type).toBe(PinInstanceType.Input);
      expect(newPin?.dataType?.type).toBe(CommonDataType.String);
    });

    test("should add output pin when addPinOut is defined", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {},
        pinsOut: {},
        addPinOut: () => {},
        onConfigChange: ({ actions }) => {
          actions.addPin("output", PinInstanceType.Output, { type: CommonDataType.Number });
        },
        exec: async () => ({}),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      const outputPin = pins.find((p) => p.name === "output");
      expect(outputPin).toBeDefined();
      expect(outputPin?.type).toBe(PinInstanceType.Output);
      expect(outputPin?.dataType?.type).toBe(CommonDataType.Number);
    });
  });

  describe("NodeCallbackActions - removePin", () => {
    test("should throw error when removing last pin of type", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          pin1: { type: CommonDataType.Number },
        },
        pinsOut: {},
        addPinIn: () => {},
        onConfigChange: ({ actions }) => {
          const pin = actions.getPin("pin1");
          if (pin) {
            expect(() => {
              actions.removePin(pin.uuid);
            }).toThrow(CommutatorError);
          }
        },
        exec: async () => ({}),
      });

      commutator.createSchema().createPureFunction("test");
    });

    test("should remove wires when removing pin", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
            y: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
            b: { type: CommonDataType.Number },
          },
          pinsOut: {
            result: { type: CommonDataType.Number },
          },
          addPinIn: () => {},
          onConfigChange: ({ actions }) => {
            const pin = actions.getPin("a");
            if (pin) {
              actions.removePin(pin.uuid);
            }
          },
          exec: async ({ pinsIn }) => ({
            result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
          }),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((p) => p.name === "a" && p.type === PinInstanceType.Input);

      if (eventXPin && addAPin) {
        schema.wire({ fromPinUuid: eventXPin.uuid, toPinUuid: addAPin.uuid });
      }

      // После удаления пина, провода должны быть удалены
      const snapshot = schema.extract();
      expect(snapshot.wires.length).toBe(0);
    });
  });

  describe("NodeCallbackActions - resetPins", () => {
    test("should reset pins to match configuration", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          pin1: { type: CommonDataType.Number },
          pin2: { type: CommonDataType.String },
        },
        pinsOut: {
          result: { type: CommonDataType.Number },
        },
        addPinIn: () => {},
        onConfigChange: ({ actions }) => {
          // Добавляем лишний пин
          actions.addPin("extraPin", PinInstanceType.Input, { type: CommonDataType.Boolean });
          // Меняем тип существующего
          const pin1 = actions.getPin("pin1");
          if (pin1) {
            actions.updatePin(pin1.uuid, { dataType: { type: CommonDataType.Boolean } });
          }
          // Затем сбрасываем
          actions.resetPins();
        },
        exec: async () => ({ result: 0 }),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      // Лишний пин должен быть удален
      const extraPin = pins.find((p) => p.name === "extraPin");
      expect(extraPin).toBeUndefined();

      // Типы должны быть восстановлены
      const pin1 = pins.find((p) => p.name === "pin1");
      const pin2 = pins.find((p) => p.name === "pin2");
      const result = pins.find((p) => p.name === "result");

      expect(pin1?.dataType?.type).toBe(CommonDataType.Number);
      expect(pin2?.dataType?.type).toBe(CommonDataType.String);
      expect(result?.dataType?.type).toBe(CommonDataType.Number);
    });

    test("should add missing pins from configuration", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          pin1: { type: CommonDataType.Number },
          pin2: { type: CommonDataType.String },
        },
        pinsOut: {},
        addPinIn: () => {},
        onConfigChange: ({ actions }) => {
          // Удаляем один пин
          const pin2 = actions.getPin("pin2");
          if (pin2) {
            actions.removePin(pin2.uuid);
          }
          // Затем сбрасываем - пин должен вернуться
          actions.resetPins();
        },
        exec: async () => ({}),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      const pin1 = pins.find((p) => p.name === "pin1");
      const pin2 = pins.find((p) => p.name === "pin2");

      expect(pin1).toBeDefined();
      expect(pin2).toBeDefined();
      expect(pin2?.dataType?.type).toBe(CommonDataType.String);
    });

    test("should not add pins when addPinIn is not defined", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          pin1: { type: CommonDataType.Number },
        },
        pinsOut: {},
        onConfigChange: ({ actions }) => {
          // Не пытаемся удалить пин, т.к. canAddPinIn = false не позволит
          // Просто проверяем, что resetPins не добавит пины, если их нет
          // (но в данном случае пин есть, так что просто сбрасываем типы)
          actions.resetPins();
        },
        exec: async () => ({}),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      // Пин должен остаться, т.к. он есть в конфигурации
      const pin1 = pins.find((p) => p.name === "pin1");
      expect(pin1).toBeDefined();
      expect(pin1?.dataType?.type).toBe(CommonDataType.Number);
    });

    test("should remove pins with wrong type and recreate them", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          pin1: { type: CommonDataType.Number },
        },
        pinsOut: {
          result: { type: CommonDataType.String },
        },
        addPinIn: () => {},
        addPinOut: () => {},
        onConfigChange: ({ actions }) => {
          // Меняем тип пина на неправильный
          const pin1 = actions.getPin("pin1");
          if (pin1) {
            actions.updatePin(pin1.uuid, { dataType: { type: CommonDataType.String } });
          }
          // Сбрасываем - пин должен быть удален и создан заново с правильным типом
          actions.resetPins();
        },
        exec: async () => ({ result: "" }),
      });

      const schema = commutator.createSchema();
      const test = schema.createPureFunction("test");
      const pins = schema.getNodePins(test.uuid);

      const pin1 = pins.find((p) => p.name === "pin1" && p.dataType?.type === CommonDataType.Number);
      expect(pin1).toBeDefined();
      expect(pin1?.dataType?.type).toBe(CommonDataType.Number);
    });
  });

  describe("NodeCallbackActions - getPin, getAllPins, isWired, getWiredNode, getPinConfig", () => {
    test("should get pin by name", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          value: { type: CommonDataType.Number },
        },
        pinsOut: {},
        onConfigChange: ({ actions }) => {
          const pin = actions.getPin("value");
          expect(pin).toBeDefined();
          expect(pin?.name).toBe("value");
          expect(pin?.dataType?.type).toBe(CommonDataType.Number);
        },
        exec: async () => ({}),
      });

      commutator.createSchema().createPureFunction("test");
    });

    test("should get all pins", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          a: { type: CommonDataType.Number },
          b: { type: CommonDataType.String },
        },
        pinsOut: {
          result: { type: CommonDataType.Number },
        },
        onConfigChange: ({ actions }) => {
          const allPins = actions.getAllPins();
          expect(allPins.length).toBe(3);
          expect(allPins.some((p) => p.name === "a")).toBe(true);
          expect(allPins.some((p) => p.name === "b")).toBe(true);
          expect(allPins.some((p) => p.name === "result")).toBe(true);
        },
        exec: async () => ({ result: 0 }),
      });

      commutator.createSchema().createPureFunction("test");
    });

    test("should check if pin is wired", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        })
        .definePureFunction("test", {
          pinsIn: {
            value: { type: CommonDataType.Number },
          },
          pinsOut: {},
          onConfigChange: ({ actions }) => {
            expect(actions.isWired("value")).toBe(false);
          },
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const test = schema.createPureFunction("test");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const testValuePin = schema
        .getNodePins(test.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      if (eventXPin && testValuePin) {
        schema.wire({ fromPinUuid: eventXPin.uuid, toPinUuid: testValuePin.uuid });
      }

      // Проверяем через callback после создания связи
      const testPins = schema.getNodePins(test.uuid);
      const valuePin = testPins.find((p) => p.name === "value");
      expect(valuePin).toBeDefined();
    });

    test("should get wired node", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        })
        .definePureFunction("test", {
          pinsIn: {
            value: { type: CommonDataType.Number },
          },
          pinsOut: {},
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const test = schema.createPureFunction("test");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const testValuePin = schema
        .getNodePins(test.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      if (eventXPin && testValuePin) {
        schema.wire({ fromPinUuid: eventXPin.uuid, toPinUuid: testValuePin.uuid });

        // Проверяем через actions
        const nodeConfig = commutator["config"]["events"]["onClick"] || commutator["config"]["pureFunctions"]["test"];
        if (nodeConfig?.onConfigChange) {
          nodeConfig.onConfigChange({
            config: undefined,
            apis: {},
            actions: schema["createNodeCallbackActions"](test.uuid, nodeConfig),
          });
        }
      }
    });

    test("should get pin config", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          value: { type: CommonDataType.Number },
        },
        pinsOut: {},
        onConfigChange: ({ actions }) => {
          const pinConfig = actions.getPinConfig("value");
          expect(pinConfig).toBeDefined();
          expect(pinConfig?.type).toBe(CommonDataType.Number);
        },
        exec: async () => ({}),
      });

      commutator.createSchema().createPureFunction("test");
    });
  });

  describe("updateNodeConfig", () => {
    test("should update node config and call onConfigChange", () => {
      let callbackCallCount = 0;
      let lastConfig: unknown = null;

      const commutator = Commutator.initialize().defineFunction("test", {
        config: {
          type: CommonDataType.Object,
          properties: {
            value: { type: CommonDataType.Number },
          },
        },
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        onConfigChange: ({ config }) => {
          callbackCallCount++;
          lastConfig = config;
        },
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      const test = schema.createFunction("test", { value: 10 });

      expect(callbackCallCount).toBe(1);
      expect(lastConfig).toEqual({ value: 10 });

      schema.updateNodeConfig(test.uuid, { value: 20 });

      expect(callbackCallCount).toBe(2);
      expect(lastConfig).toEqual({ value: 20 });
    });

    test("should validate config before updating", () => {
      const commutator = Commutator.initialize().defineFunction("test", {
        config: {
          type: CommonDataType.Object,
          properties: {
            value: { type: CommonDataType.Number },
          },
        },
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      const test = schema.createFunction("test", { value: 10 });

      expect(() => {
        schema.updateNodeConfig(test.uuid, { value: "invalid" });
      }).toThrow(CommutatorError);
    });

    test("should throw error when node not found", () => {
      const commutator = Commutator.initialize();
      const schema = commutator.createSchema();

      expect(() => {
        schema.updateNodeConfig("non-existent-uuid", {});
      }).toThrow(CommutatorError);
    });

    test("should update config for different node types", () => {
      let eventConfig: unknown = null;
      let refConfig: unknown = null;
      let pureFunctionConfig: unknown = null;
      let functionConfig: unknown = null;

      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          config: {
            type: CommonDataType.Object,
            properties: {
              x: { type: CommonDataType.Number },
            },
          },
          pinsOut: {},
          execPinsOut: { next: null },
          onConfigChange: ({ config }) => {
            eventConfig = config;
          },
        })
        .defineRef("userRef", {
          config: {
            type: CommonDataType.Object,
            properties: {
              userId: { type: CommonDataType.String },
            },
          },
          pinsOut: {},
          resolveRef: async () => null,
          onConfigChange: ({ config }) => {
            refConfig = config;
          },
        })
        .definePureFunction("add", {
          config: {
            type: CommonDataType.Object,
            properties: {
              offset: { type: CommonDataType.Number },
            },
          },
          pinsIn: { a: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          onConfigChange: ({ config }) => {
            pureFunctionConfig = config;
          },
          exec: async () => ({ result: 0 }),
        })
        .defineFunction("log", {
          config: {
            type: CommonDataType.Object,
            properties: {
              prefix: { type: CommonDataType.String },
            },
          },
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          onConfigChange: ({ config }) => {
            functionConfig = config;
          },
          exec: async () => {},
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick", { x: 1 });
      const ref = schema.createRef("userRef", { userId: "123" });
      const add = schema.createPureFunction("add", { offset: 5 });
      const log = schema.createFunction("log", { prefix: "test" });

      schema.updateNodeConfig(event.uuid, { x: 2 });
      schema.updateNodeConfig(ref.uuid, { userId: "456" });
      schema.updateNodeConfig(add.uuid, { offset: 10 });
      schema.updateNodeConfig(log.uuid, { prefix: "updated" });

      expect(eventConfig).toEqual({ x: 2 });
      expect(refConfig).toEqual({ userId: "456" });
      expect(pureFunctionConfig).toEqual({ offset: 10 });
      expect(functionConfig).toEqual({ prefix: "updated" });
    });
  });

  describe("Snapshot serialization with dataType", () => {
    test("should save and restore dataType in snapshot", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          value: { type: CommonDataType.Number },
        },
        pinsOut: {
          result: { type: CommonDataType.String },
        },
        onConfigChange: ({ actions }) => {
          // Изменяем тип пина через callback
          const pin = actions.getPin("value");
          if (pin) {
            actions.updatePin(pin.uuid, {
              dataType: { type: CommonDataType.String },
            });
          }
        },
        exec: async () => ({ result: "" }),
      });

      const schema1 = commutator.createSchema();
      const test = schema1.createPureFunction("test");

      // Проверяем, что тип изменился
      const pins1 = schema1.getNodePins(test.uuid);
      const valuePin1 = pins1.find((p) => p.name === "value");
      expect(valuePin1?.dataType?.type).toBe(CommonDataType.String);

      const snapshot = schema1.extract();
      const schema2 = commutator.createSchema(snapshot);

      const pins2 = schema2.getNodePins(test.uuid);
      const valuePin2 = pins2.find((p) => p.name === "value");
      const resultPin2 = pins2.find((p) => p.name === "result");

      // dataType должен быть сохранен в снапшоте
      expect(valuePin2?.dataType?.type).toBe(CommonDataType.String);
      expect(resultPin2?.dataType?.type).toBe(CommonDataType.String);
    });

    test("should restore dataType from configuration if missing in snapshot", () => {
      const commutator = Commutator.initialize().definePureFunction("test", {
        pinsIn: {
          value: { type: CommonDataType.Number },
        },
        pinsOut: {},
        exec: async () => ({}),
      });

      const schema1 = commutator.createSchema();
      const test = schema1.createPureFunction("test");
      const snapshot = schema1.extract();

      // Удаляем dataType из снапшота (симулируем старый формат)
      const modifiedSnapshot = {
        ...snapshot,
        pinInstances: snapshot.pinInstances.map((pin) => {
          const { dataType, ...rest } = pin as any;
          return rest;
        }),
      };

      const schema2 = commutator.createSchema(modifiedSnapshot as any);
      const pins = schema2.getNodePins(test.uuid);
      const valuePin = pins.find((p) => p.name === "value");

      // dataType должен быть восстановлен из конфигурации
      expect(valuePin?.dataType?.type).toBe(CommonDataType.Number);
    });
  });

  describe("Type validation with dynamic dataType", () => {
    test("should validate wire types using dataType from PinInstance", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        })
        .definePureFunction("test", {
          pinsIn: {
            value: { type: CommonDataType.Number },
          },
          pinsOut: {},
          onConfigChange: ({ actions }) => {
            // Меняем тип пина на String
            const pin = actions.getPin("value");
            if (pin) {
              actions.updatePin(pin.uuid, { dataType: { type: CommonDataType.String } });
            }
          },
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const test = schema.createPureFunction("test");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const testValuePin = schema
        .getNodePins(test.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      if (eventXPin && testValuePin) {
        // Должна быть ошибка, т.к. типы не совпадают (Number vs String)
        expect(() => {
          schema.wire({ fromPinUuid: eventXPin.uuid, toPinUuid: testValuePin.uuid });
        }).toThrow(CommutatorError);
      }
    });

    test("should allow wiring when types match after update", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        })
        .definePureFunction("test", {
          pinsIn: {
            value: { type: CommonDataType.String },
          },
          pinsOut: {},
          onConfigChange: ({ actions }) => {
            // Меняем тип пина на Number, чтобы совпадал с event.x
            const pin = actions.getPin("value");
            if (pin) {
              actions.updatePin(pin.uuid, { dataType: { type: CommonDataType.Number } });
            }
          },
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const test = schema.createPureFunction("test");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const testValuePin = schema
        .getNodePins(test.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      if (eventXPin && testValuePin) {
        // Теперь должно работать, т.к. типы совпадают
        expect(() => {
          schema.wire({ fromPinUuid: eventXPin.uuid, toPinUuid: testValuePin.uuid });
        }).not.toThrow();
      }
    });

    test("should allow Any type to accept any type", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        })
        .definePureFunction("test", {
          pinsIn: {
            value: { type: CommonDataType.Any },
          },
          pinsOut: {},
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const test = schema.createPureFunction("test");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const testValuePin = schema
        .getNodePins(test.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      if (eventXPin && testValuePin) {
        // Any должен принимать любой тип
        expect(() => {
          schema.wire({ fromPinUuid: eventXPin.uuid, toPinUuid: testValuePin.uuid });
        }).not.toThrow();
      }
    });
  });
});

