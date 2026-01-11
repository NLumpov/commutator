import { describe, expect, test } from "bun:test";
import { Commutator } from "./commutator";
import { CommonDataType } from "./enums";

describe("Commutator", () => {
  describe("initialize", () => {
    test("should create empty commutator", () => {
      const commutator = Commutator.initialize();
      expect(commutator).toBeDefined();
      expect(commutator.createSchema()).toBeDefined();
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
      const instance = commutator.createSchema();
      expect(instance).toBeDefined();
    });

    test("should create commutator with events", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
          y: { type: CommonDataType.Number },
        },
        execPinsOut: {
          next: null,
        },
      });

      expect(commutator).toBeDefined();
      const instance = commutator.createSchema();
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
        exec: async ({ pinsIn }) => ({
          result: (pinsIn.a ?? 0) + (pinsIn.b ?? 0),
        }),
      });

      expect(commutator).toBeDefined();
      const instance = commutator.createSchema();
      expect(instance).toBeDefined();
    });
  });

  describe("inject", () => {
    test("should inject one commutator into another", () => {
      const commutator1 = Commutator.initialize()
        .defineDataType("User", {
          type: CommonDataType.Object,
          properties: {
            name: { type: CommonDataType.String },
          },
        })
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        });

      const commutator2 = Commutator.initialize()
        .defineDataType("Product", {
          type: CommonDataType.Object,
          properties: {
            price: { type: CommonDataType.Number },
          },
        })
        .defineEvent("onHover", {
          pinsOut: {
            position: { type: CommonDataType.String },
          },
          execPinsOut: {},
        });

      const merged = commutator1.inject(commutator2);

      expect(merged).toBeDefined();
      const instance = merged.createSchema();
      expect(instance).toBeDefined();

      // Проверяем, что оба типа данных доступны
      const userEvent = instance.createEvent("onClick");
      const hoverEvent = instance.createEvent("onHover");

      expect(userEvent).toBeDefined();
      expect(hoverEvent).toBeDefined();
    });

    test("should merge data types from both commutators", () => {
      const commutator1 = Commutator.initialize().defineDataType("Type1", {
        type: CommonDataType.String,
      });

      const commutator2 = Commutator.initialize().defineDataType("Type2", {
        type: CommonDataType.Number,
      });

      const merged = commutator1.inject(commutator2);
      const instance = merged.createSchema();

      expect(instance).toBeDefined();
    });

    test("should merge events from both commutators", () => {
      const commutator1 = Commutator.initialize().defineEvent("event1", {
        pinsOut: {
          value: { type: CommonDataType.String },
        },
        execPinsOut: {},
      });

      const commutator2 = Commutator.initialize().defineEvent("event2", {
        pinsOut: {
          value: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const merged = commutator1.inject(commutator2);
      const instance = merged.createSchema();

      const event1 = instance.createEvent("event1");
      const event2 = instance.createEvent("event2");

      expect(event1).toBeDefined();
      expect(event2).toBeDefined();
    });

    test("should merge refs from both commutators", () => {
      const commutator1 = Commutator.initialize().defineRef("ref1", {
        pinsOut: {
          value: { type: CommonDataType.String },
        },
        resolveRef: async () => ({ value: "test1" }),
      });

      const commutator2 = Commutator.initialize().defineRef("ref2", {
        pinsOut: {
          value: { type: CommonDataType.String },
        },
        resolveRef: async () => ({ value: "test2" }),
      });

      const merged = commutator1.inject(commutator2);
      const instance = merged.createSchema();

      const ref1 = instance.createRef("ref1");
      const ref2 = instance.createRef("ref2");

      expect(ref1).toBeDefined();
      expect(ref2).toBeDefined();
    });

    test("should merge pure functions from both commutators", () => {
      const commutator1 = Commutator.initialize().definePureFunction("func1", {
        pinsIn: {
          a: { type: CommonDataType.Number },
        },
        pinsOut: {
          result: { type: CommonDataType.Number },
        },
        exec: async () => ({ result: 1 }),
      });

      const commutator2 = Commutator.initialize().definePureFunction("func2", {
        pinsIn: {
          b: { type: CommonDataType.Number },
        },
        pinsOut: {
          result: { type: CommonDataType.Number },
        },
        exec: async () => ({ result: 2 }),
      });

      const merged = commutator1.inject(commutator2);
      const instance = merged.createSchema();

      const func1 = instance.createPureFunction("func1");
      const func2 = instance.createPureFunction("func2");

      expect(func1).toBeDefined();
      expect(func2).toBeDefined();
    });

    test("should merge functions from both commutators", () => {
      const commutator1 = Commutator.initialize().defineFunction("func1", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        exec: async () => {},
      });

      const commutator2 = Commutator.initialize().defineFunction("func2", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        exec: async () => {},
      });

      const merged = commutator1.inject(commutator2);
      const instance = merged.createSchema();

      const func1 = instance.createFunction("func1");
      const func2 = instance.createFunction("func2");

      expect(func1).toBeDefined();
      expect(func2).toBeDefined();
    });

    test("should merge all types together", () => {
      const commutator1 = Commutator.initialize()
        .defineDataType("User", { type: CommonDataType.String })
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: {},
        })
        .defineRef("userRef", {
          pinsOut: { user: { type: CommonDataType.String } },
          resolveRef: async () => ({ user: "test" }),
        })
        .definePureFunction("add", {
          pinsIn: { a: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async () => ({ result: 0 }),
        })
        .defineFunction("log", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async () => {},
        });

      const commutator2 = Commutator.initialize()
        .defineDataType("Product", { type: CommonDataType.Number })
        .defineEvent("onHover", {
          pinsOut: { y: { type: CommonDataType.String } },
          execPinsOut: {},
        });

      const merged = commutator1.inject(commutator2);
      const instance = merged.createSchema();

      // Проверяем, что все типы доступны
      const onClick = instance.createEvent("onClick");
      const onHover = instance.createEvent("onHover");
      const userRef = instance.createRef("userRef");
      const add = instance.createPureFunction("add");
      const log = instance.createFunction("log");

      expect(onClick).toBeDefined();
      expect(onHover).toBeDefined();
      expect(userRef).toBeDefined();
      expect(add).toBeDefined();
      expect(log).toBeDefined();
    });
  });
});
