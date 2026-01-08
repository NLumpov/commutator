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
          next: {},
        },
      });

      const instance = commutator.createSchema();
      const eventInstance = instance.createEvent("onClick");

      expect(eventInstance).toBeDefined();
      expect(eventInstance.type).toBe(NodeType.Event);
      expect(eventInstance.name).toBe("onClick");
      expect(eventInstance.uuid).toBeDefined();
      expect(eventInstance.x).toBe(0);
      expect(eventInstance.y).toBe(0);
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

      expect(event1.uuid).not.toBe(event2.uuid);
      expect(event1.uuid).not.toBe(event3.uuid);
      expect(event2.uuid).not.toBe(event3.uuid);
      expect(event1.name).toBe("onClick");
      expect(event2.name).toBe("onHover");
      expect(event3.name).toBe("onClick");
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
      expect(refInstance.type).toBe(NodeType.Ref);
      expect(refInstance.name).toBe("userRef");
      expect(refInstance.uuid).toBeDefined();
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
        canAddPinIn: false,
        canAddPinOut: false,
        exec: async ({ pinsIn }) => ({
          result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
        }),
      });

      const instance = commutator.createSchema();
      const pureFunctionInstance = instance.createPureFunction("add");

      expect(pureFunctionInstance).toBeDefined();
      expect(pureFunctionInstance.type).toBe(NodeType.PureFunction);
      expect(pureFunctionInstance.name).toBe("add");
      expect(pureFunctionInstance.uuid).toBeDefined();
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
          start: {},
        },
        execPinsOut: {
          next: {},
        },
        canAddPinIn: false,
        canAddPinOut: false,
        canAddExecPinIn: false,
        canAddExecPinOut: false,
        exec: async () => {},
      });

      const instance = commutator.createSchema();
      const functionInstance = instance.createFunction("log");

      expect(functionInstance).toBeDefined();
      expect(functionInstance.type).toBe(NodeType.Function);
      expect(functionInstance.name).toBe("log");
      expect(functionInstance.uuid).toBeDefined();
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(outputPinUuid).toBeDefined();
        expect(inputPinUuid).toBeDefined();

        expect(() => {
          instance.wire(outputPinUuid!, inputPinUuid!);
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire(outputPinUuid!, inputPinUuid!);
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire(outputPinUuid!, inputPinUuid!);
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire(outputPinUuid!, inputPinUuid!);
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source1 = instance.createEvent("source1");
        const source2 = instance.createEvent("source2");
        const target = instance.createPureFunction("target");

        const outputPin1Uuid = instance
          .getNodePins(source1.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const outputPin2Uuid = instance
          .getNodePins(source2.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        // First wire should succeed
        expect(() => {
          instance.wire(outputPin1Uuid!, inputPinUuid!);
        }).not.toThrow();

        // Second wire to the same input should fail
        expect(() => {
          instance.wire(outputPin2Uuid!, inputPinUuid!);
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          })
          .definePureFunction("target2", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target1 = instance.createPureFunction("target1");
        const target2 = instance.createPureFunction("target2");

        const outputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPin1Uuid = instance
          .getNodePins(target1.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;
        const inputPin2Uuid = instance
          .getNodePins(target2.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        // Both wires should succeed
        expect(() => {
          instance.wire(outputPinUuid!, inputPin1Uuid!);
        }).not.toThrow();

        expect(() => {
          instance.wire(outputPinUuid!, inputPin2Uuid!);
        }).not.toThrow();
      });
    });

    describe("exec pins (execPinsOut -> execPinsIn)", () => {
      test("should wire exec output pin to exec input pin", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: {
              next: {},
            },
          })
          .defineFunction("target", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: {
              start: {},
            },
            execPinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const execOutputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        expect(() => {
          instance.wire(execOutputPinUuid!, execInputPinUuid!);
        }).not.toThrow();
      });

      test("should allow multiple exec pins to connect to same exec input", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source1", {
            pinsOut: {},
            execPinsOut: {
              next: {},
            },
          })
          .defineEvent("source2", {
            pinsOut: {},
            execPinsOut: {
              next: {},
            },
          })
          .defineFunction("target", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: {
              start: {},
            },
            execPinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source1 = instance.createEvent("source1");
        const source2 = instance.createEvent("source2");
        const target = instance.createFunction("target");

        const execOutputPin1Uuid = instance
          .getNodePins(source1.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execOutputPin2Uuid = instance
          .getNodePins(source2.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        // First wire should succeed
        expect(() => {
          instance.wire(execOutputPin1Uuid!, execInputPinUuid!);
        }).not.toThrow();

        // Second wire to the same exec input should also succeed (multiple exec pins allowed)
        expect(() => {
          instance.wire(execOutputPin2Uuid!, execInputPinUuid!);
        }).not.toThrow();
      });

      test("should not allow one exec output to connect to multiple exec inputs", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: {
              next: {},
            },
          })
          .defineFunction("target1", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: {
              start: {},
            },
            execPinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          })
          .defineFunction("target2", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: {
              start: {},
            },
            execPinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target1 = instance.createFunction("target1");
        const target2 = instance.createFunction("target2");

        const execOutputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInputPin1Uuid = instance
          .getNodePins(target1.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
        const execInputPin2Uuid = instance
          .getNodePins(target2.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        // First wire should succeed
        expect(() => {
          instance.wire(execOutputPinUuid!, execInputPin1Uuid!);
        }).not.toThrow();

        // Second wire from the same exec output should fail
        expect(() => {
          instance.wire(execOutputPinUuid!, execInputPin2Uuid!);
        }).toThrow("ExecPinOut wire already exists");
      });
    });

    describe("error cases", () => {
      test("should throw error when pin not found", () => {
        const commutator = Commutator.initialize();
        const instance = commutator.createSchema();

        expect(() => {
          instance.wire("non-existent-pin-1", "non-existent-pin-2");
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
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;

        expect(() => {
          instance.wire(outputPinUuid!, outputPinUuid!);
        }).toThrow(CommutatorError);
      });

      test("should throw error on invalid connection (input to input)", () => {
        const commutator = Commutator.initialize()
          .definePureFunction("func1", {
            pinsIn: {
              a: { type: CommonDataType.String },
            },
            pinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          })
          .definePureFunction("func2", {
            pinsIn: {
              b: { type: CommonDataType.String },
            },
            pinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const func1 = instance.createPureFunction("func1");
        const func2 = instance.createPureFunction("func2");

        const inputPin1Uuid = instance
          .getNodePins(func1.uuid)
          .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input)?.uuid;
        const inputPin2Uuid = instance
          .getNodePins(func2.uuid)
          .find((pin) => pin.name === "b" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire(inputPin1Uuid!, inputPin2Uuid!);
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
          .getNodePins(event1.uuid)
          .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Output)?.uuid;
        const outputPin2Uuid = instance
          .getNodePins(event2.uuid)
          .find((pin) => pin.name === "b" && pin.type === PinInstanceType.Output)?.uuid;

        expect(() => {
          instance.wire(outputPin1Uuid!, outputPin2Uuid!);
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
            execPinsIn: {
              start: {},
            },
            execPinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const dataOutputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const execInputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        expect(() => {
          instance.wire(dataOutputPinUuid!, execInputPinUuid!);
        }).toThrow(CommutatorError);
      });

      test("should throw error on invalid connection (exec pin to data pin)", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: {
              next: {},
            },
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const execOutputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const dataInputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire(execOutputPinUuid!, dataInputPinUuid!);
        }).toThrow(CommutatorError);
      });

      test("should throw error on invalid connection (exec pin to data pin - reversed)", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: {
              next: {},
            },
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const execOutputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const dataInputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        // Try reversed order
        expect(() => {
          instance.wire(dataInputPinUuid!, execOutputPinUuid!);
        }).toThrow(CommutatorError);
      });
    });

    describe("reverse connection (input to output)", () => {
      test("should automatically reverse connection when input is first parameter", () => {
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        // Wire in correct order
        expect(() => {
          instance.wire(outputPinUuid!, inputPinUuid!);
        }).not.toThrow();

        // Wire in reverse order should also work
        const source2 = instance.createEvent("source");
        const target2 = instance.createPureFunction("target");
        const outputPin2Uuid = instance
          .getNodePins(source2.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPin2Uuid = instance
          .getNodePins(target2.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire(inputPin2Uuid!, outputPin2Uuid!);
        }).not.toThrow();
      });

      test("should automatically reverse connection for exec pins when input is first parameter", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {},
            execPinsOut: {
              next: {},
            },
          })
          .defineFunction("target", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: {
              start: {},
            },
            execPinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const execOutputPinUuid = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInputPinUuid = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        // Wire in reverse order should work
        expect(() => {
          instance.wire(execInputPinUuid!, execOutputPinUuid!);
        }).not.toThrow();
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const stringOutput = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "stringValue" && pin.type === PinInstanceType.Output)?.uuid;
        const stringInput = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "stringValue" && pin.type === PinInstanceType.Input)?.uuid;
        const numberOutput = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "numberValue" && pin.type === PinInstanceType.Output)?.uuid;
        const numberInput = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "numberValue" && pin.type === PinInstanceType.Input)?.uuid;
        const booleanOutput = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "booleanValue" && pin.type === PinInstanceType.Output)?.uuid;
        const booleanInput = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "booleanValue" && pin.type === PinInstanceType.Input)?.uuid;

        expect(() => {
          instance.wire(stringOutput!, stringInput!);
          instance.wire(numberOutput!, numberInput!);
          instance.wire(booleanOutput!, booleanInput!);
        }).not.toThrow();
      });

      test("should handle mixed data and exec pins", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {
              next: {},
            },
          })
          .defineFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            execPinsIn: {
              start: {},
            },
            execPinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const dataOutput = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const dataInput = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;
        const execOutput = instance
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const execInput = instance
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        expect(() => {
          instance.wire(dataOutput!, dataInput!);
          instance.wire(execOutput!, execInput!);
        }).not.toThrow();
      });
    });

    describe("cyclic connection detection", () => {
      describe("exec pins cycles", () => {
        test("should detect direct exec cycle (A -> B -> A)", () => {
          const commutator = Commutator.initialize()
            .defineFunction("func1", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: {
                start: {},
              },
              execPinsOut: {
                next: {},
              },
              canAddPinIn: false,
              canAddPinOut: false,
              canAddExecPinIn: false,
              canAddExecPinOut: false,
              exec: async () => {},
            })
            .defineFunction("func2", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: {
                start: {},
              },
              execPinsOut: {
                next: {},
              },
              canAddPinIn: false,
              canAddPinOut: false,
              canAddExecPinIn: false,
              canAddExecPinOut: false,
              exec: async () => {},
            });

          const instance = commutator.createSchema();
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");

          const func1ExecOut = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func2ExecIn = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
          const func2ExecOut = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func1ExecIn = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

          // Создаем первое соединение (func1 -> func2)
          expect(() => {
            instance.wire(func1ExecOut!, func2ExecIn!);
          }).not.toThrow();

          // Создаем второе соединение (func2 -> func1), это должно создать цикл
          expect(() => {
            instance.wire(func2ExecOut!, func1ExecIn!);
          }).toThrow(CommutatorError);
        });

        test("should detect indirect exec cycle (A -> B -> C -> A)", () => {
          const commutator = Commutator.initialize()
            .defineFunction("func1", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: {
                start: {},
              },
              execPinsOut: {
                next: {},
              },
              canAddPinIn: false,
              canAddPinOut: false,
              canAddExecPinIn: false,
              canAddExecPinOut: false,
              exec: async () => {},
            })
            .defineFunction("func2", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: {
                start: {},
              },
              execPinsOut: {
                next: {},
              },
              canAddPinIn: false,
              canAddPinOut: false,
              canAddExecPinIn: false,
              canAddExecPinOut: false,
              exec: async () => {},
            })
            .defineFunction("func3", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: {
                start: {},
              },
              execPinsOut: {
                next: {},
              },
              canAddPinIn: false,
              canAddPinOut: false,
              canAddExecPinIn: false,
              canAddExecPinOut: false,
              exec: async () => {},
            });

          const instance = commutator.createSchema();
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");
          const func3 = instance.createFunction("func3");

          const func1ExecOut = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func2ExecIn = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
          const func2ExecOut = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func3ExecIn = instance
            .getNodePins(func3.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
          const func3ExecOut = instance
            .getNodePins(func3.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func1ExecIn = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

          // Создаем цепочку: func1 -> func2 -> func3
          expect(() => {
            instance.wire(func1ExecOut!, func2ExecIn!);
            instance.wire(func2ExecOut!, func3ExecIn!);
          }).not.toThrow();

          // Попытка создать соединение func3 -> func1 должна создать цикл
          expect(() => {
            instance.wire(func3ExecOut!, func1ExecIn!);
          }).toThrow(CommutatorError);
        });

        test("should allow non-cyclic exec connections", () => {
          const commutator = Commutator.initialize()
            .defineEvent("event", {
              pinsOut: {},
              execPinsOut: {
                next: {},
              },
            })
            .defineFunction("func1", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: {
                start: {},
              },
              execPinsOut: {
                next: {},
              },
              canAddPinIn: false,
              canAddPinOut: false,
              canAddExecPinIn: false,
              canAddExecPinOut: false,
              exec: async () => {},
            })
            .defineFunction("func2", {
              pinsIn: {},
              pinsOut: {},
              execPinsIn: {
                start: {},
              },
              execPinsOut: {},
              canAddPinIn: false,
              canAddPinOut: false,
              canAddExecPinIn: false,
              canAddExecPinOut: false,
              exec: async () => {},
            });

          const instance = commutator.createSchema();
          const event = instance.createEvent("event");
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");

          const eventExecOut = instance
            .getNodePins(event.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func1ExecIn = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;
          const func1ExecOut = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
          const func2ExecIn = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

          // Создаем линейную цепочку: event -> func1 -> func2 (без циклов)
          expect(() => {
            instance.wire(eventExecOut!, func1ExecIn!);
            instance.wire(func1ExecOut!, func2ExecIn!);
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
              canAddPinIn: false,
              canAddPinOut: false,
              exec: async () => ({ output: "" }),
            })
            .definePureFunction("func2", {
              pinsIn: {
                input: { type: CommonDataType.String },
              },
              pinsOut: {
                output: { type: CommonDataType.String },
              },
              canAddPinIn: false,
              canAddPinOut: false,
              exec: async () => ({ output: "" }),
            });

          const instance = commutator.createSchema();
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");

          const func1Out = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func2In = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;
          const func2Out = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func1In = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;

          // Создаем первое соединение (func1 -> func2)
          expect(() => {
            instance.wire(func1Out!, func2In!);
          }).not.toThrow();

          // Создаем второе соединение (func2 -> func1), это должно создать цикл
          expect(() => {
            instance.wire(func2Out!, func1In!);
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
              canAddPinIn: false,
              canAddPinOut: false,
              exec: async () => ({ output: 0 }),
            })
            .definePureFunction("func2", {
              pinsIn: {
                input: { type: CommonDataType.Number },
              },
              pinsOut: {
                output: { type: CommonDataType.Number },
              },
              canAddPinIn: false,
              canAddPinOut: false,
              exec: async () => ({ output: 0 }),
            })
            .definePureFunction("func3", {
              pinsIn: {
                input: { type: CommonDataType.Number },
              },
              pinsOut: {
                output: { type: CommonDataType.Number },
              },
              canAddPinIn: false,
              canAddPinOut: false,
              exec: async () => ({ output: 0 }),
            });

          const instance = commutator.createSchema();
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");
          const func3 = instance.createPureFunction("func3");

          const func1Out = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func2In = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;
          const func2Out = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func3In = instance
            .getNodePins(func3.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;
          const func3Out = instance
            .getNodePins(func3.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func1In = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;

          // Создаем цепочку: func1 -> func2 -> func3
          expect(() => {
            instance.wire(func1Out!, func2In!);
            instance.wire(func2Out!, func3In!);
          }).not.toThrow();

          // Попытка создать соединение func3 -> func1 должна создать цикл
          expect(() => {
            instance.wire(func3Out!, func1In!);
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
              canAddPinIn: false,
              canAddPinOut: false,
              exec: async () => ({ output: "" }),
            })
            .definePureFunction("func2", {
              pinsIn: {
                input: { type: CommonDataType.String },
              },
              pinsOut: {},
              canAddPinIn: false,
              canAddPinOut: false,
              exec: async () => ({}),
            });

          const instance = commutator.createSchema();
          const event = instance.createEvent("event");
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");

          const eventOut = instance
            .getNodePins(event.uuid)
            .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
          const func1In = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;
          const func1Out = instance
            .getNodePins(func1.uuid)
            .find((pin) => pin.name === "output" && pin.type === PinInstanceType.Output)?.uuid;
          const func2In = instance
            .getNodePins(func2.uuid)
            .find((pin) => pin.name === "input" && pin.type === PinInstanceType.Input)?.uuid;

          // Создаем линейную цепочку: event -> func1 -> func2 (без циклов)
          expect(() => {
            instance.wire(eventOut!, func1In!);
            instance.wire(func1Out!, func2In!);
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
            execPinsIn: {
              start: {},
            },
            execPinsOut: {
              next: {},
            },
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          })
          .defineFunction("func2", {
            pinsIn: {
              data: { type: CommonDataType.String },
            },
            pinsOut: {
              data: { type: CommonDataType.String },
            },
            execPinsIn: {
              start: {},
            },
            execPinsOut: {
              next: {},
            },
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
            exec: async () => {},
          });

        const instance = commutator.createSchema();
        const func1 = instance.createFunction("func1");
        const func2 = instance.createFunction("func2");

        const func1DataOut = instance
          .getNodePins(func1.uuid)
          .find((pin) => pin.name === "data" && pin.type === PinInstanceType.Output)?.uuid;
        const func2DataIn = instance
          .getNodePins(func2.uuid)
          .find((pin) => pin.name === "data" && pin.type === PinInstanceType.Input)?.uuid;
        const func2ExecOut = instance
          .getNodePins(func2.uuid)
          .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec)?.uuid;
        const func1ExecIn = instance
          .getNodePins(func1.uuid)
          .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec)?.uuid;

        // Создаем соединение data: func1 -> func2
        expect(() => {
          instance.wire(func1DataOut!, func2DataIn!);
        }).not.toThrow();

        // Создаем соединение exec: func2 -> func1 (это не должно создавать цикл для data pins)
        expect(() => {
          instance.wire(func2ExecOut!, func1ExecIn!);
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
          execPinsOut: {
            next: {},
          },
        });

        const schema1 = commutator.createSchema();
        const event1 = schema1.createEvent("onClick");
        schema1.moveNode(event1.uuid, 10, 20);

        const snapshot = schema1.extract();
        const schema2 = commutator.createSchema(snapshot);
        const restoredSnapshot = schema2.extract();

        expect(restoredSnapshot.events).toHaveLength(1);
        expect(restoredSnapshot.events[0]?.name).toBe("onClick");
        expect(restoredSnapshot.events[0]?.uuid).toBe(event1.uuid);
        expect(restoredSnapshot.events[0]?.x).toBe(10);
        expect(restoredSnapshot.events[0]?.y).toBe(20);
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async ({ pinsIn }) => ({
              result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
            }),
          })
          .defineFunction("log", {
            pinsIn: {
              message: { type: CommonDataType.String },
            },
            pinsOut: {},
            execPinsIn: {
              start: {},
            },
            execPinsOut: {
              next: {},
            },
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
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

        expect(restoredSnapshot.events).toHaveLength(1);
        expect(restoredSnapshot.refs).toHaveLength(1);
        expect(restoredSnapshot.pureFunctions).toHaveLength(1);
        expect(restoredSnapshot.functions).toHaveLength(1);

        expect(restoredSnapshot.events[0]?.uuid).toBe(event1.uuid);
        expect(restoredSnapshot.refs[0]?.uuid).toBe(ref1.uuid);
        expect(restoredSnapshot.pureFunctions[0]?.uuid).toBe(pureFunc1.uuid);
        expect(restoredSnapshot.functions[0]?.uuid).toBe(func1.uuid);
      });

      test("should extract and restore schema with pins and wires", () => {
        const commutator = Commutator.initialize()
          .defineEvent("source", {
            pinsOut: {
              value: { type: CommonDataType.String },
            },
            execPinsOut: {
              next: {},
            },
          })
          .definePureFunction("target", {
            pinsIn: {
              value: { type: CommonDataType.String },
            },
            pinsOut: {},
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({}),
          });

        const schema1 = commutator.createSchema();
        const source = schema1.createEvent("source");
        const target = schema1.createPureFunction("target");

        const outputPinUuid = schema1
          .getNodePins(source.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Output)?.uuid;
        const inputPinUuid = schema1
          .getNodePins(target.uuid)
          .find((pin) => pin.name === "value" && pin.type === PinInstanceType.Input)?.uuid;

        schema1.wire(outputPinUuid!, inputPinUuid!);

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
          canAddPinIn: false,
          canAddPinOut: false,
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
          canAddPinIn: false,
          canAddPinOut: false,
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
          execPinsIn: {
            start: {},
          },
          execPinsOut: {
            next: {},
          },
          canAddPinIn: false,
          canAddPinOut: false,
          canAddExecPinIn: false,
          canAddExecPinOut: false,
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
          execPinsIn: {
            start: {},
          },
          execPinsOut: {
            next: {},
          },
          canAddPinIn: false,
          canAddPinOut: false,
          canAddExecPinIn: false,
          canAddExecPinOut: false,
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({ result: 0 }),
          })
          .defineFunction("log", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: {
              start: {},
            },
            execPinsOut: {
              next: {},
            },
            canAddPinIn: false,
            canAddPinOut: false,
            canAddExecPinIn: false,
            canAddExecPinOut: false,
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
          expect(restoredSnapshot.events).toHaveLength(1);
          expect(restoredSnapshot.refs).toHaveLength(1);
          expect(restoredSnapshot.pureFunctions).toHaveLength(1);
          expect(restoredSnapshot.functions).toHaveLength(1);
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
            canAddPinIn: false,
            canAddPinOut: false,
            exec: async () => ({ result: "" }),
          });

        const schema1 = commutator.createSchema();
        schema1.createEvent("onClick");
        schema1.createPureFunction("process");
        const snapshot = schema1.extract();

        expect(() => {
          const schema2 = commutator.createSchema(snapshot);
          const restoredSnapshot = schema2.extract();
          expect(restoredSnapshot.events).toHaveLength(1);
          expect(restoredSnapshot.pureFunctions).toHaveLength(1);
        }).not.toThrow();
      });
    });
  });
});
