import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator, NodeType } from "../commutator";
import { CommutatorError } from "../commutator/commutator-error";
import { PinInstanceType } from "./enums";

describe("CommutatorSchema", () => {
  describe("createEvent", () => {
    test("should create event instance", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
          y: { type: CommonDataType.Number },
        },
        execPinsOut: {
          next: null,
        },
      });

      const instance = commutator.createSchema();
      const eventInstance = instance.createEvent("onClick");

      expect(eventInstance).toBeDefined();
      expect(eventInstance.instance.type).toBe(NodeType.Event);
      expect(eventInstance.instance.name).toBe("onClick");
      expect(eventInstance.instance.uuid).toBeDefined();
      expect(eventInstance.instance.x).toBe(0);
      expect(eventInstance.instance.y).toBe(0);
    });

    test("should create multiple event instances", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        })
        .defineEvent("onHover", {
          pinsOut: {
            position: { type: CommonDataType.String },
          },
          execPinsOut: {},
        });

      const instance = commutator.createSchema();
      const event1 = instance.createEvent("onClick");
      const event2 = instance.createEvent("onHover");
      const event3 = instance.createEvent("onClick");

      expect(event1.instance.uuid).not.toBe(event2.instance.uuid);
      expect(event1.instance.uuid).not.toBe(event3.instance.uuid);
      expect(event2.instance.uuid).not.toBe(event3.instance.uuid);
      expect(event1.instance.name).toBe("onClick");
      expect(event2.instance.name).toBe("onHover");
      expect(event3.instance.name).toBe("onClick");
    });
  });

  describe("createRef", () => {
    test("should create ref instance", () => {
      const commutator = Commutator.initialize().defineRef("userRef", {
        pinsOut: {
          user: { type: CommonDataType.String },
        },
        resolveRef: async () => ({ user: "test" }),
      });

      const instance = commutator.createSchema();
      const refInstance = instance.createRef("userRef");

      expect(refInstance).toBeDefined();
      expect(refInstance.instance.type).toBe(NodeType.Ref);
      expect(refInstance.instance.name).toBe("userRef");
      expect(refInstance.instance.uuid).toBeDefined();
    });
  });

  describe("createPureFunction", () => {
    test("should create pure function instance", () => {
      const commutator = Commutator.initialize().definePureFunction("add", {
        pinsIn: {
          a: { type: CommonDataType.Number },
          b: { type: CommonDataType.Number },
        },
        pinsOut: {
          result: { type: CommonDataType.Number },
        },
        exec: async ({ pinsIn }) => ({
          result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
        }),
      });

      const instance = commutator.createSchema();
      const pureFunctionInstance = instance.createPureFunction("add");

      expect(pureFunctionInstance).toBeDefined();
      expect(pureFunctionInstance.instance.type).toBe(NodeType.PureFunction);
      expect(pureFunctionInstance.instance.name).toBe("add");
      expect(pureFunctionInstance.instance.uuid).toBeDefined();
    });
  });

  describe("createFunction", () => {
    test("should create function instance", () => {
      const commutator = Commutator.initialize().defineFunction("log", {
        pinsIn: {
          message: { type: CommonDataType.String },
        },
        pinsOut: {},
        execPinsIn: {
          start: null,
        },
        execPinsOut: {
          next: null,
        },
        exec: async () => {},
      });

      const instance = commutator.createSchema();
      const functionInstance = instance.createFunction("log");

      expect(functionInstance).toBeDefined();
      expect(functionInstance.instance.type).toBe(NodeType.Function);
      expect(functionInstance.instance.name).toBe("log");
      expect(functionInstance.instance.uuid).toBeDefined();
    });
  });

  describe("wire", () => {
    describe("data pins (pinsOut -> pinsIn)", () => {
      test("should wire output pin to input pin with matching types", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {},
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(outputPinUuid).toBeDefined();
        expect(inputPinUuid).toBeDefined();

        expect(() => {
          instance.wire({ fromPinUuid: outputPinUuid!, toPinUuid: inputPinUuid! });
        }).not.toThrow();
      });

      test("should wire output pin to input pin with Any type accepting any type", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.Number },
            },
            execPinsOut: {},
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.Any },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: outputPinUuid!, toPinUuid: inputPinUuid! });
        }).not.toThrow();
      });

      test("should wire output pin to input pin with String type accepting String", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {},
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: outputPinUuid!, toPinUuid: inputPinUuid! });
        }).not.toThrow();
      });

      test("should throw error on type mismatch", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {},
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.Number },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: outputPinUuid!, toPinUuid: inputPinUuid! });
        }).toThrow(CommutatorError);
      });

      test("should throw error when input pin already has a wire", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source1", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {},
          })
          .defineEvent("source2", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {},
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source1 = instance.createEvent("source1");
        const source2 = instance.createEvent("source2");
        const target = instance.createPureFunction("target");

        const outputPin1Uuid = instance
          .getNodePins(source1.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const outputPin2Uuid = instance
          .getNodePins(source2.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        // First wire should succeed
        expect(() => {
          instance.wire({ fromPinUuid: outputPin1Uuid!, toPinUuid: inputPinUuid! });
        }).not.toThrow();

        // Second wire to the same input should fail
        expect(() => {
          instance.wire({ fromPinUuid: outputPin2Uuid!, toPinUuid: inputPinUuid! });
        }).toThrow(CommutatorError);
      });

      test("should allow multiple output pins to connect to different input pins", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {},
          })
          .definePureFunction("target1", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          })
          .definePureFunction("target2", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target1 = instance.createPureFunction("target1");
        const target2 = instance.createPureFunction("target2");

        const outputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPin1Uuid = instance
          .getNodePins(target1.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;
        const inputPin2Uuid = instance
          .getNodePins(target2.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        // Both wires should succeed
        expect(() => {
          instance.wire({ fromPinUuid: outputPinUuid!, toPinUuid: inputPin1Uuid! });
        }).not.toThrow();

        expect(() => {
          instance.wire({ fromPinUuid: outputPinUuid!, toPinUuid: inputPin2Uuid! });
        }).not.toThrow();
      });
    });

    describe("exec pins (execPinsOut -> execPinsIn)", () => {
      test("should wire exec output pin to exec input pin", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: {
              next: null,
            },
          })
          .defineFunction("target", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: {
                start: null,
            },
            execPinsOut: {},
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const execOutputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: execOutputPinUuid!, toPinUuid: execInputPinUuid! });
        }).not.toThrow();
      });

      test("should allow multiple exec pins to connect to same exec input", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source1", {
            pinsOut: {},
            execPinsOut: { next: null },
          })
          .defineEvent("source2", {
            pinsOut: {},
            execPinsOut: { next: null },
          })
          .defineFunction("target", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: {},
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source1 = instance.createEvent("source1");
        const source2 = instance.createEvent("source2");
        const target = instance.createFunction("target");

        const execOutputPin1Uuid = instance
          .getNodePins(source1.instance.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execOutputPin2Uuid = instance
          .getNodePins(source2.instance.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        // First wire should succeed
        expect(() => {
          instance.wire({ fromPinUuid: execOutputPin1Uuid!, toPinUuid: execInputPinUuid! });
        }).not.toThrow();

        // Second wire to the same exec input should also succeed (multiple exec pins allowed)
        expect(() => {
          instance.wire({ fromPinUuid: execOutputPin2Uuid!, toPinUuid: execInputPinUuid! });
        }).not.toThrow();
      });

      test("should not allow one exec output to connect to multiple exec inputs", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: { next: null },
          })
          .defineFunction("target1", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: {},
            exec: async () => {},
          })
          .defineFunction("target2", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: {},
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target1 = instance.createFunction("target1");
        const target2 = instance.createFunction("target2");

        const execOutputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInputPin1Uuid = instance
          .getNodePins(target1.instance.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
        const execInputPin2Uuid = instance
          .getNodePins(target2.instance.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        // First wire should succeed
        expect(() => {
          instance.wire({ fromPinUuid: execOutputPinUuid!, toPinUuid: execInputPin1Uuid! }  );
        }).not.toThrow();

        // Second wire from the same exec output should fail
        expect(() => {
          instance.wire({ fromPinUuid: execOutputPinUuid!, toPinUuid: execInputPin2Uuid! });
        }).toThrow(CommutatorError);
      });
    });

    describe("error cases", () => {
      test("should throw error when pin not found", () => {
        const commutator = Commutator.initialize();
        const instance = commutator.createSchema();

        expect(() => {
          instance.wire({ fromPinUuid: "non-existent-pin-1", toPinUuid: "non-existent-pin-2" });
        }).toThrow(CommutatorError);
      });

      test("should throw error on self-loop", () => {
        const commutator = Commutator.initialize().defineEvent("source", {
          pinsOut: {
            value: { type: CommonDataType.String },
          },
          execPinsOut: {},
        });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");

        const outputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: outputPinUuid!, toPinUuid: outputPinUuid! });
        }).toThrow(CommutatorError);
      });

      test("should throw error on invalid connection (input to input)", () => {
        const commutator = Commutator.initialize()
          .definePureFunction("func1", {
            pinsIn: {
              a: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          })
          .definePureFunction("func2", {
            pinsIn: {
              b: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const func1 = instance.createPureFunction("func1");
        const func2 = instance.createPureFunction("func2");

        const inputPin1Uuid = instance
          .getNodePins(func1.instance.uuid)
          .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input)?.uuid;
        const inputPin2Uuid = instance
          .getNodePins(func2.instance.uuid)
          .find((pin) => pin.name === "b" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: inputPin1Uuid!, toPinUuid: inputPin2Uuid! });
        }).toThrow(CommutatorError);
      });

      test("should throw error on invalid connection (output to output)", () => {
        const commutator = Commutator.initialize()
          .defineEvent("event1", {
            pinsOut: {
              a: { type: CommonDataType.String },
            },
            execPinsOut: {},
          })
          .defineEvent("event2", {
            pinsOut: {
              b: { type: CommonDataType.String },
            },
            execPinsOut: {},
          });

        const instance = commutator.createSchema();
        const event1 = instance.createEvent("event1");
        const event2 = instance.createEvent("event2");

        const outputPin1Uuid = instance
          .getNodePins(event1.instance.uuid)
          .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Output)?.uuid;
        const outputPin2Uuid = instance
          .getNodePins(event2.instance.uuid)
          .find((pin) => pin.name === "b" && pin.type === PinInstanceType.Output)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: outputPin1Uuid!, toPinUuid: outputPin2Uuid! });
        }).toThrow(CommutatorError);
      });

      test("should throw error on invalid connection (data pin to exec pin)", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {},
          })
          .defineFunction("target", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: {},
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const dataOutputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const execInputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: dataOutputPinUuid!, toPinUuid: execInputPinUuid! });
        }).toThrow(CommutatorError);
      });

      test("should throw error on invalid connection (exec pin to data pin)", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: { next: null },
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const execOutputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const dataInputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: execOutputPinUuid!, toPinUuid: dataInputPinUuid! });
        }).toThrow(CommutatorError);
      });

      test("should throw error on invalid connection (exec pin to data pin - reversed)", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: { next: null },
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const execOutputPinUuid = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const dataInputPinUuid = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        // Try reversed order
        expect(() => {
          instance.wire({ fromPinUuid: dataInputPinUuid!, toPinUuid: execOutputPinUuid! });
        }).toThrow(CommutatorError);
      });
    });

    describe("complex scenarios", () => {
      test("should handle multiple data types correctly", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              stringValue: { type: CommonDataType.String },
              numberValue: { type: CommonDataType.Number },
              booleanValue: { type: CommonDataType.Boolean },
            },
            execPinsOut: {},
          })
          .definePureFunction("target", {
            pinsIn: {
              stringValue: { type: CommonDataType.String },
              numberValue: { type: CommonDataType.Number },
              booleanValue: { type: CommonDataType.Boolean },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const stringOutput = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "stringValue" && pin.type === PinInstanceType.Output)?.uuid;
        const stringInput = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "stringValue" && pin.type === PinInstanceType.Input)?.uuid;
        const numberOutput = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "numberValue" && pin.type === PinInstanceType.Output)?.uuid;
        const numberInput = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "numberValue" && pin.type === PinInstanceType.Input)?.uuid;
        const booleanOutput = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "booleanValue" && pin.type === PinInstanceType.Output)?.uuid;
        const booleanInput = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "booleanValue" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: stringOutput!, toPinUuid: stringInput! });
          instance.wire({ fromPinUuid: numberOutput!, toPinUuid: numberInput! });
          instance.wire({ fromPinUuid: booleanOutput!, toPinUuid: booleanInput! });
        }).not.toThrow();
      });

      test("should handle mixed data and exec pins", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: { next: null },
          })
          .defineFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: {},
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const dataOutput = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const dataInput = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;
        const execOutput = instance
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInput = instance
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        expect(() => {
          instance.wire({ fromPinUuid: dataOutput!, toPinUuid: dataInput! });
          instance.wire({ fromPinUuid: execOutput!, toPinUuid: execInput! });
        }).not.toThrow();
      });
    });

    describe("cyclic connection detection", () => {
      describe("exec pins cycles", () => {
        test("should allow direct exec cycle (A -> B -> A)", () => {
          const commutator = Commutator.initialize()
            .defineFunction("func1", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: { start: null },
              execPinsOut: { next: null },
              exec: async () => {},
            })
            .defineFunction("func2", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: { start: null },
              execPinsOut: { next: null },
              exec: async () => {},
            });

          const instance = commutator.createSchema();
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");

          const func1ExecOut = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func2ExecIn = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
          const func2ExecOut = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func1ExecIn = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

          // Создаем первое соединение (func1 -> func2)
          expect(() => {
            instance.wire({ fromPinUuid: func1ExecOut!, toPinUuid: func2ExecIn! });
          }).not.toThrow();

          // Создаем второе соединение (func2 -> func1), это должно создать цикл
          expect(() => {
            instance.wire({ fromPinUuid: func2ExecOut!, toPinUuid: func1ExecIn! });
          }).not.toThrow();
        });

        test("should allow indirect exec cycle (A -> B -> C -> A)", () => {
          const commutator = Commutator.initialize()
            .defineFunction("func1", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: { start: null },
              execPinsOut: { next: null },
              exec: async () => {},
            })
            .defineFunction("func2", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: { start: null },
              execPinsOut: { next: null },
              exec: async () => {},
            })
            .defineFunction("func3", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: { start: null },
              execPinsOut: { next: null },
              exec: async () => {},
            });

          const instance = commutator.createSchema();
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");
          const func3 = instance.createFunction("func3");

          const func1ExecOut = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func2ExecIn = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
          const func2ExecOut = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func3ExecIn = instance
            .getNodePins(func3.instance.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
          const func3ExecOut = instance
            .getNodePins(func3.instance.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func1ExecIn = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

          // Создаем цепочку: func1 -> func2 -> func3
          expect(() => {
            instance.wire({ fromPinUuid: func1ExecOut!, toPinUuid: func2ExecIn! });
            instance.wire({ fromPinUuid: func2ExecOut!, toPinUuid: func3ExecIn! });
          }).not.toThrow();

          // Попытка создать соединение func3 -> func1 должна создать цикл
          expect(() => {
            instance.wire({ fromPinUuid: func3ExecOut!, toPinUuid: func1ExecIn! });
          }).not.toThrow();
        });

        test("should allow non-cyclic exec connections", () => {
          const commutator = Commutator.initialize()
            .defineEvent("event", {
              pinsOut: {},
              execPinsOut: { next: null },
            })
            .defineFunction("func1", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: { start: null },
              execPinsOut: { next: null },
              exec: async () => {},
            })
            .defineFunction("func2", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: { start: null },
              execPinsOut: { next: null },
              exec: async () => {},
            });

          const instance = commutator.createSchema();
          const event = instance.createEvent("event");
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");

          const eventExecOut = instance
            .getNodePins(event.instance.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func1ExecIn = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
          const func1ExecOut = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func2ExecIn = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

          // Создаем линейную цепочку: event -> func1 -> func2 (без циклов)
          expect(() => {
            instance.wire({ fromPinUuid: eventExecOut!, toPinUuid: func1ExecIn! });
            instance.wire({ fromPinUuid: func1ExecOut!, toPinUuid: func2ExecIn! });
          }).not.toThrow();
        });
      });

      describe("data pins cycles", () => {
        test("should detect direct data cycle (A -> B -> A)", () => {
          const commutator = Commutator.initialize()
            .definePureFunction("func1", {
              pinsIn: {
                input: { type: CommonDataType.String },
              },
              pinsOut: {
                output: { type: CommonDataType.String },
              },
              exec: async () => ({ output: "" }),
            })
            .definePureFunction("func2", {
              pinsIn: {
                input: { type: CommonDataType.String },
              },
              pinsOut: {
                output: { type: CommonDataType.String },
              },
              exec: async () => ({ output: "" }),
            });

          const instance = commutator.createSchema();
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");

          const func1Out = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func2In = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;
          const func2Out = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func1In = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;

          // Создаем первое соединение (func1 -> func2)
          expect(() => {
            instance.wire({ fromPinUuid: func1Out!, toPinUuid: func2In! });
          }).not.toThrow();

          // Создаем второе соединение (func2 -> func1), это должно создать цикл
          expect(() => {
            instance.wire({ fromPinUuid: func2Out!, toPinUuid: func1In! });
          }).toThrow(CommutatorError);
        });

        test("should detect indirect data cycle (A -> B -> C -> A)", () => {
          const commutator = Commutator.initialize()
            .definePureFunction("func1", {
              pinsIn: {
                input: { type: CommonDataType.Number },
              },
              pinsOut: {
                output: { type: CommonDataType.Number },
              },
              exec: async () => ({ output: 0 }),
            })
            .definePureFunction("func2", {
              pinsIn: {
                input: { type: CommonDataType.Number },
              },
              pinsOut: {
                output: { type: CommonDataType.Number },
              },
              exec: async () => ({ output: 0 }),
            })
            .definePureFunction("func3", {
              pinsIn: {
                input: { type: CommonDataType.Number },
              },
              pinsOut: {
                output: { type: CommonDataType.Number },
              },
              exec: async () => ({ output: 0 }),
            });

          const instance = commutator.createSchema();
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");
          const func3 = instance.createPureFunction("func3");

          const func1Out = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func2In = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;
          const func2Out = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func3In = instance
            .getNodePins(func3.instance.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;
          const func3Out = instance
            .getNodePins(func3.instance.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func1In = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;

          // Создаем цепочку: func1 -> func2 -> func3
          expect(() => {
            instance.wire({ fromPinUuid: func1Out!, toPinUuid: func2In! });
            instance.wire({ fromPinUuid: func2Out!, toPinUuid: func3In! });
          }).not.toThrow();

          // Попытка создать соединение func3 -> func1 должна создать цикл
          expect(() => {
            instance.wire({ fromPinUuid: func3Out!, toPinUuid: func1In! });
          }).toThrow(CommutatorError);
        });

        test("should allow non-cyclic data connections", () => {
          const commutator = Commutator.initialize()
            .defineEvent("event", {
              pinsOut: {
                value: { type: CommonDataType.String },
              },
              execPinsOut: {},
            })
            .definePureFunction("func1", {
              pinsIn: {
                input: { type: CommonDataType.String },
              },
              pinsOut: {
                output: { type: CommonDataType.String },
              },
              exec: async () => ({ output: "" }),
            })
            .definePureFunction("func2", {
              pinsIn: {
                input: { type: CommonDataType.String },
              },
              pinsOut: {},
              exec: async () => ({}),
            });

          const instance = commutator.createSchema();
          const event = instance.createEvent("event");
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");

          const eventOut = instance
            .getNodePins(event.instance.uuid)
            .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
          const func1In = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;
          const func1Out = instance
            .getNodePins(func1.instance.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func2In = instance
            .getNodePins(func2.instance.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;

          // Создаем линейную цепочку: event -> func1 -> func2 (без циклов)
          expect(() => {
            instance.wire({ fromPinUuid: eventOut!, toPinUuid: func1In! });
            instance.wire({ fromPinUuid: func1Out!, toPinUuid: func2In! });
          }).not.toThrow();
        });
      });

      test("should not mix exec and data pins in cycle detection", () => {
        const commutator = Commutator.initialize()
          .defineFunction("func1", {
            pinsIn: {
              data: { type: CommonDataType.String },
            },
            pinsOut: {
              data: { type: CommonDataType.String },
            },
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("func2", {
            pinsIn: {
              data: { type: CommonDataType.String },
            },
            pinsOut: {
              data: { type: CommonDataType.String },
            },
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const func1 = instance.createFunction("func1");
        const func2 = instance.createFunction("func2");

        const func1DataOut = instance
          .getNodePins(func1.instance.uuid)
          .find((pin) => pin.name === "data" && pin.type === PinInstanceType.Output)?.uuid;
        const func2DataIn = instance
          .getNodePins(func2.instance.uuid)
          .find((pin) => pin.name === "data" && pin.type === PinInstanceType.Input)?.uuid;
        const func2ExecOut = instance
          .getNodePins(func2.instance.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const func1ExecIn = instance
          .getNodePins(func1.instance.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        // Создаем соединение data: func1 -> func2
        expect(() => {
          instance.wire({ fromPinUuid: func1DataOut!, toPinUuid: func2DataIn! });
        }).not.toThrow();

        // Создаем соединение exec: func2 -> func1 (это не должно создавать цикл для data pins)
        expect(() => {
          instance.wire({ fromPinUuid: func2ExecOut!, toPinUuid: func1ExecIn! });
        }).not.toThrow();
      });
    });
  });

  describe("snapshot", () => {
    describe("extract and restore", () => {
      test("should extract and restore schema with events", () => {
        const commutator = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
            y: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        });

        const schema1 = commutator.createSchema();
        const event1 = schema1.createEvent("onClick");
        schema1.moveNode(event1.instance.uuid, 10, 20);

        const snapshot = schema1.extract();
        const schema2 = commutator.createSchema(snapshot);
        const restoredSnapshot = schema2.extract();

        expect(restoredSnapshot.nodes).toHaveLength(1);
        expect(restoredSnapshot.nodes[0]?.name).toBe("onClick");
        expect(restoredSnapshot.nodes[0]?.uuid).toBe(event1.instance.uuid);
        expect(restoredSnapshot.nodes[0]?.x).toBe(10);
        expect(restoredSnapshot.nodes[0]?.y).toBe(20);
      });

      test("should extract and restore schema with multiple node types", () => {
        const commutator = Commutator.initialize()
          .defineEvent("onClick", {
            pinsOut: {
              x: { type: CommonDataType.Number },
            },
            execPinsOut: {},
          })
          .defineRef("userRef", {
            pinsOut: {
              user: { type: CommonDataType.String },
            },
            resolveRef: async () => ({ user: "test" }),
          })
          .definePureFunction("add", {
            pinsIn: {
              a: { type: CommonDataType.Number },
              b: { type: CommonDataType.Number },
            },
            pinsOut: {
              result: { type: CommonDataType.Number },
            },
            exec: async ({ pinsIn }) => ({
              result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
            }),
          })
          .defineFunction("log", {
            pinsIn: {
              message: { type: CommonDataType.String },
            },
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema1 = commutator.createSchema();
        const event1 = schema1.createEvent("onClick");
        const ref1 = schema1.createRef("userRef");
        const pureFunc1 = schema1.createPureFunction("add");
        const func1 = schema1.createFunction("log");

        const snapshot = schema1.extract();
        const schema2 = commutator.createSchema(snapshot);
        const restoredSnapshot = schema2.extract();

        expect(restoredSnapshot.nodes).toHaveLength(4);

        expect(restoredSnapshot.nodes[0]?.uuid).toBe(event1.instance.uuid);
        expect(restoredSnapshot.nodes[1]?.uuid).toBe(ref1.instance.uuid);
        expect(restoredSnapshot.nodes[2]?.uuid).toBe(pureFunc1.instance.uuid);
        expect(restoredSnapshot.nodes[3]?.uuid).toBe(func1.instance.uuid);
      });

      test("should extract and restore schema with pins and wires", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: { next: null },
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            exec: async () => ({}),
          });

        const schema1 = commutator.createSchema();
        const source = schema1.createEvent("source");
        const target = schema1.createPureFunction("target");

        const outputPinUuid = schema1
          .getNodePins(source.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = schema1
          .getNodePins(target.instance.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        schema1.wire({ fromPinUuid: outputPinUuid!, toPinUuid: inputPinUuid! });

        const snapshot = schema1.extract();
        const schema2 = commutator.createSchema(snapshot);
        const restoredSnapshot = schema2.extract();

        expect(restoredSnapshot.pinInstances).toHaveLength(snapshot.pinInstances.length);
        expect(restoredSnapshot.wires).toHaveLength(1);
        expect(restoredSnapshot.wires[0]?.from).toBe(outputPinUuid);
        expect(restoredSnapshot.wires[0]?.to).toBe(inputPinUuid);
      });
    });

    describe("validation", () => {
      test("should throw error when event type not found in configuration", () => {
        const commutator1 = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        });

        const schema1 = commutator1.createSchema();
        schema1.createEvent("onClick");
        const snapshot = schema1.extract();

        const commutator2 = Commutator.initialize().defineEvent("onHover", {
          pinsOut: {
            y: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        });

        expect(() => {
          commutator2.createSchema(snapshot);
        }).toThrow(CommutatorError);
      });

      test("should throw error when ref type not found in configuration", () => {
        const commutator1 = Commutator.initialize().defineRef("userRef", {
          pinsOut: {
            user: { type: CommonDataType.String },
          },
          resolveRef: async () => ({ user: "test" }),
        });

        const schema1 = commutator1.createSchema();
        schema1.createRef("userRef");
        const snapshot = schema1.extract();

        const commutator2 = Commutator.initialize().defineRef("postRef", {
          pinsOut: {
            post: { type: CommonDataType.String },
          },
          resolveRef: async () => ({ post: "test" }),
        });

        expect(() => {
          commutator2.createSchema(snapshot);
        }).toThrow(CommutatorError);
      });

      test("should throw error when pureFunction type not found in configuration", () => {
        const commutator1 = Commutator.initialize().definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
            b: { type: CommonDataType.Number },
          },
          pinsOut: {
            result: { type: CommonDataType.Number },
          },
          exec: async ({ pinsIn }) => ({
            result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
          }),
        });

        const schema1 = commutator1.createSchema();
        schema1.createPureFunction("add");
        const snapshot = schema1.extract();

        const commutator2 = Commutator.initialize().definePureFunction("multiply", {
          pinsIn: {
            a: { type: CommonDataType.Number },
            b: { type: CommonDataType.Number },
          },
          pinsOut: {
            result: { type: CommonDataType.Number },
          },
          exec: async ({ pinsIn }) => ({
            result: (pinsIn.a ?? 0) * (pinsIn.b ?? 0),
          }),
        });

        expect(() => {
          commutator2.createSchema(snapshot);
        }).toThrow(CommutatorError);
      });

      test("should throw error when function type not found in configuration", () => {
        const commutator1 = Commutator.initialize().defineFunction("log", {
          pinsIn: {
            message: { type: CommonDataType.String },
          },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async () => {},
        });

        const schema1 = commutator1.createSchema();
        schema1.createFunction("log");
        const snapshot = schema1.extract();

        const commutator2 = Commutator.initialize().defineFunction("print", {
          pinsIn: {
            message: { type: CommonDataType.String },
          },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async () => {},
        });

        expect(() => {
          commutator2.createSchema(snapshot);
        }).toThrow(CommutatorError);
      });

      test("should successfully restore when all node types match", () => {
        const commutator = Commutator.initialize()
          .defineEvent("onClick", {
            pinsOut: {
              x: { type: CommonDataType.Number },
            },
            execPinsOut: {},
          })
          .defineRef("userRef", {
            pinsOut: {
              user: { type: CommonDataType.String },
            },
            resolveRef: async () => ({ user: "test" }),
          })
          .definePureFunction("add", {
            pinsIn: {
              a: { type: CommonDataType.Number },
            },
            pinsOut: {
              result: { type: CommonDataType.Number },
            },
            exec: async () => ({ result: 0 }),
          })
          .defineFunction("log", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema1 = commutator.createSchema();
        schema1.createEvent("onClick");
        schema1.createRef("userRef");
        schema1.createPureFunction("add");
        schema1.createFunction("log");

        const snapshot = schema1.extract();

        expect(() => {
          const schema2 = commutator.createSchema(snapshot);
          const restoredSnapshot = schema2.extract();
          expect(restoredSnapshot.nodes).toHaveLength(4);
        }).not.toThrow();
      });

      test("should throw error when pin references non-existent dataType", () => {
        const commutator1 = Commutator.initialize()
          .defineDataType("User", {
            type: CommonDataType.Object,
            properties: {},
          })
          .defineEvent("onClick", {
            pinsOut: {
              user: { type: "User" },
            },
            execPinsOut: {},
          });

        const schema1 = commutator1.createSchema();
        schema1.createEvent("onClick");
        const snapshot = schema1.extract();

        // Создаем коммутатор без dataType "User"
        const commutator2 = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {
            // @ts-expect-error тут специально выключаем типы, так как намеренно делаем ошибку в коде
            user: { type: "User" },
          },
          execPinsOut: {},
        });

        expect(() => {
          commutator2.createSchema(snapshot);
        }).toThrow(CommutatorError);
      });

      test("should successfully restore when all dataTypes match", () => {
        const commutator = Commutator.initialize()
          .defineDataType("User", {
            type: CommonDataType.Object,
            properties: {
              name: { type: CommonDataType.String },
            },
          })
          .defineEvent("onClick", {
            pinsOut: {
              user: { type: "User" },
            },
            execPinsOut: {},
          })
          .definePureFunction("process", {
            pinsIn: {
              user: { type: "User" },
            },
            pinsOut: {
              result: { type: CommonDataType.String },
            },
            exec: async () => ({ result: "" }),
          });

        const schema1 = commutator.createSchema();
        schema1.createEvent("onClick");
        schema1.createPureFunction("process");
        const snapshot = schema1.extract();

        expect(() => {
          const schema2 = commutator.createSchema(snapshot);
          const restoredSnapshot = schema2.extract();
          expect(restoredSnapshot.nodes).toHaveLength(2);
        }).not.toThrow();
      });
    });
  });

  describe("Simplified API", () => {
    describe("getPin", () => {
      test("should get pin by node uuid and pin name", () => {
        const commutator = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
            y: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        });

        const schema = commutator.createSchema();
        const event = schema.createEvent("onClick");
        const pin = schema.getPin(event.instance.uuid, "x");

        expect(pin).toBeDefined();
        expect(pin.name).toBe("x");
        expect(pin.type).toBe(PinInstanceType.Output);
        expect(pin.nodeUuid).toBe(event.instance.uuid);
      });

      test("should throw error when pin not found", () => {
        const commutator = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        });

        const schema = commutator.createSchema();
        const event = schema.createEvent("onClick");

        expect(() => {
          schema.getPin(event.instance.uuid, "nonexistent");
        }).toThrow(CommutatorError);
      });
    });

    describe("wire with options object", () => {
      test("should wire pins using named parameters", () => {
        const commutator = Commutator.initialize()
          .defineEvent("onClick", {
            pinsOut: {
              x: { type: CommonDataType.Number },
            },
            execPinsOut: { next: null },
          })
          .definePureFunction("add", {
            pinsIn: {
              a: { type: CommonDataType.Number },
            },
            pinsOut: {
              result: { type: CommonDataType.Number },
            },
            exec: async ({ pinsIn }) => ({
              result: pinsIn.a ?? 0,
            }),
          });

        const schema = commutator.createSchema();
        const event = schema.createEvent("onClick");
        const add = schema.createPureFunction("add");

        schema.wire({
          from: { node: event.instance.uuid, pin: "x" },
          to: { node: add.instance.uuid, pin: "a" },
        });

        const wires = schema.extract().wires;
        expect(wires.length).toBe(1);
      });
    });
    describe("Fluent API - create* methods", () => {
      test("should support fluent API after createEvent", () => {
        const commutator = Commutator.initialize()
          .defineEvent("onClick", {
            pinsOut: {
              x: { type: CommonDataType.Number },
            },
            execPinsOut: { next: null },
          })
          .definePureFunction("add", {
            pinsIn: {
              a: { type: CommonDataType.Number },
            },
            pinsOut: {
              result: { type: CommonDataType.Number },
            },
            exec: async ({ pinsIn }) => ({
              result: pinsIn.a ?? 0,
            }),
          });

        const schema = commutator.createSchema();
        const add = schema.createPureFunction("add");

        schema.createEvent("onClick").wire("x", add, "a");

        const wires = schema.extract().wires;
        expect(wires.length).toBe(1);
      });

      test("should support chaining wire calls", () => {
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
            exec: async ({ pinsIn }) => ({
              result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
            }),
          });

        const schema = commutator.createSchema();
        const add = schema.createPureFunction("add");

        const event = schema.createEvent("onClick");
        event.wire("x", add, "a").wire("y", add, "b");

        const wires = schema.extract().wires;
        expect(wires.length).toBe(2);
      });

      test("exposes node properties only through instance", () => {
        const commutator = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        });

        const schema = commutator.createSchema();
        const event = schema.createEvent("onClick");

        expect(event.instance.uuid).toBeDefined();
        expect(event.instance.type).toBe(NodeType.Event);
        expect(event.instance.name).toBe("onClick");
        expect(event.instance.x).toBe(0);
        expect(event.instance.y).toBe(0);
        for (const property of ["uuid", "type", "name", "config", "x", "y"]) {
          expect(property in event).toBe(false);
        }
        // @ts-expect-error Node properties are available through instance only.
        expect(event.uuid).toBeUndefined();
      });
    });
  });
});
