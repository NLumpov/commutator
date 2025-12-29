import { describe, test, expect } from "bun:test";
import { Commutator } from "./commutator";
import { CommonDataType, NodeType, PinInstanceType } from "./enums";

describe("Commutator", () => {
  describe("initialize", () => {
    test("should create empty commutator", () => {
      const commutator = Commutator.initialize();
      expect(commutator).toBeDefined();
      expect(commutator.createInstance()).toBeDefined();
    });

    test("should create commutator with data types", () => {
      const commutator = Commutator.initialize().defineDataType("User", {
        type: CommonDataType.Object,
        properties: {
          name: { type: CommonDataType.String },
          age: { type: CommonDataType.Number },
        },
      });

      expect(commutator).toBeDefined();
      const instance = commutator.createInstance();
      expect(instance).toBeDefined();
    });

    test("should create commutator with events", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
          y: { type: CommonDataType.Number },
        },
        execPinsOut: {
          next: {},
        },
      });

      expect(commutator).toBeDefined();
      const instance = commutator.createInstance();
      expect(instance).toBeDefined();
    });

    test("should create commutator with pure functions", () => {
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

      expect(commutator).toBeDefined();
      const instance = commutator.createInstance();
      expect(instance).toBeDefined();
    });
  });
});

describe("CommutatorInstance", () => {
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

      const instance = commutator.createInstance();
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

      const instance = commutator.createInstance();
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

      const instance = commutator.createInstance();
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

      const instance = commutator.createInstance();
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

      const instance = commutator.createInstance();
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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );
        const inputPinUuid = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );

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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );
        const inputPinUuid = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );

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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );
        const inputPinUuid = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );

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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );
        const inputPinUuid = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );

        expect(() => {
          instance.wire(outputPinUuid!, inputPinUuid!);
        }).toThrow("Type mismatch");
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

        const instance = commutator.createInstance();
        const source1 = instance.createEvent("source1");
        const source2 = instance.createEvent("source2");
        const target = instance.createPureFunction("target");

        const outputPin1Uuid = instance.getPinUuid(
          source1,
          "value",
          PinInstanceType.Output
        );
        const outputPin2Uuid = instance.getPinUuid(
          source2,
          "value",
          PinInstanceType.Output
        );
        const inputPinUuid = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );

        // First wire should succeed
        expect(() => {
          instance.wire(outputPin1Uuid!, inputPinUuid!);
        }).not.toThrow();

        // Second wire to the same input should fail
        expect(() => {
          instance.wire(outputPin2Uuid!, inputPinUuid!);
        }).toThrow("To wire already exists");
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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target1 = instance.createPureFunction("target1");
        const target2 = instance.createPureFunction("target2");

        const outputPinUuid = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );
        const inputPin1Uuid = instance.getPinUuid(
          target1,
          "value",
          PinInstanceType.Input
        );
        const inputPin2Uuid = instance.getPinUuid(
          target2,
          "value",
          PinInstanceType.Input
        );

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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const execOutputPinUuid = instance.getPinUuid(
          source,
          "next",
          PinInstanceType.OutputExec
        );
        const execInputPinUuid = instance.getPinUuid(
          target,
          "start",
          PinInstanceType.InputExec
        );

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

        const instance = commutator.createInstance();
        const source1 = instance.createEvent("source1");
        const source2 = instance.createEvent("source2");
        const target = instance.createFunction("target");

        const execOutputPin1Uuid = instance.getPinUuid(
          source1,
          "next",
          PinInstanceType.OutputExec
        );
        const execOutputPin2Uuid = instance.getPinUuid(
          source2,
          "next",
          PinInstanceType.OutputExec
        );
        const execInputPinUuid = instance.getPinUuid(
          target,
          "start",
          PinInstanceType.InputExec
        );

        // First wire should succeed
        expect(() => {
          instance.wire(execOutputPin1Uuid!, execInputPinUuid!);
        }).not.toThrow();

        // Second wire to the same exec input should also succeed (multiple exec pins allowed)
        expect(() => {
          instance.wire(execOutputPin2Uuid!, execInputPinUuid!);
        }).not.toThrow();
      });

      test("should allow one exec output to connect to multiple exec inputs", () => {
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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target1 = instance.createFunction("target1");
        const target2 = instance.createFunction("target2");

        const execOutputPinUuid = instance.getPinUuid(
          source,
          "next",
          PinInstanceType.OutputExec
        );
        const execInputPin1Uuid = instance.getPinUuid(
          target1,
          "start",
          PinInstanceType.InputExec
        );
        const execInputPin2Uuid = instance.getPinUuid(
          target2,
          "start",
          PinInstanceType.InputExec
        );

        // Both wires should succeed
        expect(() => {
          instance.wire(execOutputPinUuid!, execInputPin1Uuid!);
        }).not.toThrow();

        expect(() => {
          instance.wire(execOutputPinUuid!, execInputPin2Uuid!);
        }).not.toThrow();
      });
    });

    describe("error cases", () => {
      test("should throw error when pin not found", () => {
        const commutator = Commutator.initialize();
        const instance = commutator.createInstance();

        expect(() => {
          instance.wire("non-existent-pin-1", "non-existent-pin-2");
        }).toThrow("Pin not found");
      });

      test("should throw error on self-loop", () => {
        const commutator = Commutator.initialize().defineEvent("source", {
          pinsOut: {
            value: { type: CommonDataType.String },
          },
          execPinsOut: {},
        });

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");

        const outputPinUuid = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );

        expect(() => {
          instance.wire(outputPinUuid!, outputPinUuid!);
        }).toThrow("Self-loop");
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

        const instance = commutator.createInstance();
        const func1 = instance.createPureFunction("func1");
        const func2 = instance.createPureFunction("func2");

        const inputPin1Uuid = instance.getPinUuid(
          func1,
          "a",
          PinInstanceType.Input
        );
        const inputPin2Uuid = instance.getPinUuid(
          func2,
          "b",
          PinInstanceType.Input
        );

        expect(() => {
          instance.wire(inputPin1Uuid!, inputPin2Uuid!);
        }).toThrow("Invalid connection");
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

        const instance = commutator.createInstance();
        const event1 = instance.createEvent("event1");
        const event2 = instance.createEvent("event2");

        const outputPin1Uuid = instance.getPinUuid(
          event1,
          "a",
          PinInstanceType.Output
        );
        const outputPin2Uuid = instance.getPinUuid(
          event2,
          "b",
          PinInstanceType.Output
        );

        expect(() => {
          instance.wire(outputPin1Uuid!, outputPin2Uuid!);
        }).toThrow("Invalid connection");
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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const dataOutputPinUuid = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );
        const execInputPinUuid = instance.getPinUuid(
          target,
          "start",
          PinInstanceType.InputExec
        );

        expect(() => {
          instance.wire(dataOutputPinUuid!, execInputPinUuid!);
        }).toThrow("Invalid connection");
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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const execOutputPinUuid = instance.getPinUuid(
          source,
          "next",
          PinInstanceType.OutputExec
        );
        const dataInputPinUuid = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );

        expect(() => {
          instance.wire(execOutputPinUuid!, dataInputPinUuid!);
        }).toThrow("Invalid connection");
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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const execOutputPinUuid = instance.getPinUuid(
          source,
          "next",
          PinInstanceType.OutputExec
        );
        const dataInputPinUuid = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );

        // Try reversed order
        expect(() => {
          instance.wire(dataInputPinUuid!, execOutputPinUuid!);
        }).toThrow("Invalid connection");
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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const outputPinUuid = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );
        const inputPinUuid = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );

        // Wire in correct order
        expect(() => {
          instance.wire(outputPinUuid!, inputPinUuid!);
        }).not.toThrow();

        // Wire in reverse order should also work
        const source2 = instance.createEvent("source");
        const target2 = instance.createPureFunction("target");
        const outputPin2Uuid = instance.getPinUuid(
          source2,
          "value",
          PinInstanceType.Output
        );
        const inputPin2Uuid = instance.getPinUuid(
          target2,
          "value",
          PinInstanceType.Input
        );

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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const execOutputPinUuid = instance.getPinUuid(
          source,
          "next",
          PinInstanceType.OutputExec
        );
        const execInputPinUuid = instance.getPinUuid(
          target,
          "start",
          PinInstanceType.InputExec
        );

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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createPureFunction("target");

        const stringOutput = instance.getPinUuid(
          source,
          "stringValue",
          PinInstanceType.Output
        );
        const stringInput = instance.getPinUuid(
          target,
          "stringValue",
          PinInstanceType.Input
        );
        const numberOutput = instance.getPinUuid(
          source,
          "numberValue",
          PinInstanceType.Output
        );
        const numberInput = instance.getPinUuid(
          target,
          "numberValue",
          PinInstanceType.Input
        );
        const booleanOutput = instance.getPinUuid(
          source,
          "booleanValue",
          PinInstanceType.Output
        );
        const booleanInput = instance.getPinUuid(
          target,
          "booleanValue",
          PinInstanceType.Input
        );

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

        const instance = commutator.createInstance();
        const source = instance.createEvent("source");
        const target = instance.createFunction("target");

        const dataOutput = instance.getPinUuid(
          source,
          "value",
          PinInstanceType.Output
        );
        const dataInput = instance.getPinUuid(
          target,
          "value",
          PinInstanceType.Input
        );
        const execOutput = instance.getPinUuid(
          source,
          "next",
          PinInstanceType.OutputExec
        );
        const execInput = instance.getPinUuid(
          target,
          "start",
          PinInstanceType.InputExec
        );

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

          const instance = commutator.createInstance();
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");

          const func1ExecOut = instance.getPinUuid(
            func1,
            "next",
            PinInstanceType.OutputExec
          );
          const func2ExecIn = instance.getPinUuid(
            func2,
            "start",
            PinInstanceType.InputExec
          );
          const func2ExecOut = instance.getPinUuid(
            func2,
            "next",
            PinInstanceType.OutputExec
          );
          const func1ExecIn = instance.getPinUuid(
            func1,
            "start",
            PinInstanceType.InputExec
          );

          // Создаем первое соединение (func1 -> func2)
          expect(() => {
            instance.wire(func1ExecOut!, func2ExecIn!);
          }).not.toThrow();

          // Создаем второе соединение (func2 -> func1), это должно создать цикл
          expect(() => {
            instance.wire(func2ExecOut!, func1ExecIn!);
          }).toThrow("Cyclic connection detected in exec pins");
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

          const instance = commutator.createInstance();
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");
          const func3 = instance.createFunction("func3");

          const func1ExecOut = instance.getPinUuid(
            func1,
            "next",
            PinInstanceType.OutputExec
          );
          const func2ExecIn = instance.getPinUuid(
            func2,
            "start",
            PinInstanceType.InputExec
          );
          const func2ExecOut = instance.getPinUuid(
            func2,
            "next",
            PinInstanceType.OutputExec
          );
          const func3ExecIn = instance.getPinUuid(
            func3,
            "start",
            PinInstanceType.InputExec
          );
          const func3ExecOut = instance.getPinUuid(
            func3,
            "next",
            PinInstanceType.OutputExec
          );
          const func1ExecIn = instance.getPinUuid(
            func1,
            "start",
            PinInstanceType.InputExec
          );

          // Создаем цепочку: func1 -> func2 -> func3
          expect(() => {
            instance.wire(func1ExecOut!, func2ExecIn!);
            instance.wire(func2ExecOut!, func3ExecIn!);
          }).not.toThrow();

          // Попытка создать соединение func3 -> func1 должна создать цикл
          expect(() => {
            instance.wire(func3ExecOut!, func1ExecIn!);
          }).toThrow("Cyclic connection detected in exec pins");
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

          const instance = commutator.createInstance();
          const event = instance.createEvent("event");
          const func1 = instance.createFunction("func1");
          const func2 = instance.createFunction("func2");

          const eventExecOut = instance.getPinUuid(
            event,
            "next",
            PinInstanceType.OutputExec
          );
          const func1ExecIn = instance.getPinUuid(
            func1,
            "start",
            PinInstanceType.InputExec
          );
          const func1ExecOut = instance.getPinUuid(
            func1,
            "next",
            PinInstanceType.OutputExec
          );
          const func2ExecIn = instance.getPinUuid(
            func2,
            "start",
            PinInstanceType.InputExec
          );

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

          const instance = commutator.createInstance();
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");

          const func1Out = instance.getPinUuid(
            func1,
            "output",
            PinInstanceType.Output
          );
          const func2In = instance.getPinUuid(
            func2,
            "input",
            PinInstanceType.Input
          );
          const func2Out = instance.getPinUuid(
            func2,
            "output",
            PinInstanceType.Output
          );
          const func1In = instance.getPinUuid(
            func1,
            "input",
            PinInstanceType.Input
          );

          // Создаем первое соединение (func1 -> func2)
          expect(() => {
            instance.wire(func1Out!, func2In!);
          }).not.toThrow();

          // Создаем второе соединение (func2 -> func1), это должно создать цикл
          expect(() => {
            instance.wire(func2Out!, func1In!);
          }).toThrow("Cyclic connection detected in data pins");
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

          const instance = commutator.createInstance();
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");
          const func3 = instance.createPureFunction("func3");

          const func1Out = instance.getPinUuid(
            func1,
            "output",
            PinInstanceType.Output
          );
          const func2In = instance.getPinUuid(
            func2,
            "input",
            PinInstanceType.Input
          );
          const func2Out = instance.getPinUuid(
            func2,
            "output",
            PinInstanceType.Output
          );
          const func3In = instance.getPinUuid(
            func3,
            "input",
            PinInstanceType.Input
          );
          const func3Out = instance.getPinUuid(
            func3,
            "output",
            PinInstanceType.Output
          );
          const func1In = instance.getPinUuid(
            func1,
            "input",
            PinInstanceType.Input
          );

          // Создаем цепочку: func1 -> func2 -> func3
          expect(() => {
            instance.wire(func1Out!, func2In!);
            instance.wire(func2Out!, func3In!);
          }).not.toThrow();

          // Попытка создать соединение func3 -> func1 должна создать цикл
          expect(() => {
            instance.wire(func3Out!, func1In!);
          }).toThrow("Cyclic connection detected in data pins");
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

          const instance = commutator.createInstance();
          const event = instance.createEvent("event");
          const func1 = instance.createPureFunction("func1");
          const func2 = instance.createPureFunction("func2");

          const eventOut = instance.getPinUuid(
            event,
            "value",
            PinInstanceType.Output
          );
          const func1In = instance.getPinUuid(
            func1,
            "input",
            PinInstanceType.Input
          );
          const func1Out = instance.getPinUuid(
            func1,
            "output",
            PinInstanceType.Output
          );
          const func2In = instance.getPinUuid(
            func2,
            "input",
            PinInstanceType.Input
          );

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

        const instance = commutator.createInstance();
        const func1 = instance.createFunction("func1");
        const func2 = instance.createFunction("func2");

        const func1DataOut = instance.getPinUuid(
          func1,
          "data",
          PinInstanceType.Output
        );
        const func2DataIn = instance.getPinUuid(
          func2,
          "data",
          PinInstanceType.Input
        );
        const func2ExecOut = instance.getPinUuid(
          func2,
          "next",
          PinInstanceType.OutputExec
        );
        const func1ExecIn = instance.getPinUuid(
          func1,
          "start",
          PinInstanceType.InputExec
        );

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
});
