import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator, NodeType } from "../commutator";
import { CommutatorError } from "../commutator/commutator-error";
import { ulid } from "../../util/ulid";
import { PinInstanceType } from "./enums";
import { SchemaValidator } from "./schema-validator";
import type { SchemaSnapshot } from "./types";

describe("SchemaValidator", () => {
  describe("validateSnapshot", () => {
    test("should validate valid snapshot", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
            y: { type: CommonDataType.Number },
          },
          execPinsOut: { next: {} },
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
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      schema.wire(eventXPin!.uuid, addAPin!.uuid);

      const snapshot = schema.extract();

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).not.toThrow();
    });

    test("should throw error when snapshot is null", () => {
      const commutator = Commutator.initialize();
      expect(() => {
        SchemaValidator.validateSnapshot(null as any, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when snapshot.events is not an array", () => {
      const commutator = Commutator.initialize();
      const snapshot: SchemaSnapshot = {
        events: null as any,
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [],
        wires: [],
      };
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error on duplicate node UUID", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      const event1 = schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Создаем дубликат UUID
      snapshot.events.push({ ...event1 });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when node config not found", () => {
      const commutator1 = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: {},
      });

      const schema1 = commutator1.createSchema();
      schema1.createEvent("onClick");
      const snapshot = schema1.extract();

      const commutator2 = Commutator.initialize().defineEvent("onHover", {
        pinsOut: {},
        execPinsOut: {},
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator2["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error on duplicate pin UUID", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Создаем дубликат UUID пина
      if (snapshot.pinInstances.length > 0 && snapshot.pinInstances[0]) {
        snapshot.pinInstances.push({ ...snapshot.pinInstances[0] });
      }

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when pin belongs to non-existent node", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Изменяем nodeUuid пина на несуществующий
      if (snapshot.pinInstances.length > 0 && snapshot.pinInstances[0]) {
        snapshot.pinInstances[0] = {
          ...snapshot.pinInstances[0],
          nodeUuid: "non-existent-uuid",
        };
      }

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when wire references non-existent pin", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
          },
          pinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      schema.wire(eventXPin!.uuid, addAPin!.uuid);
      const snapshot = schema.extract();

      // Изменяем UUID пина в проводе на несуществующий
      if (snapshot.wires[0]) {
        snapshot.wires[0] = {
          ...snapshot.wires[0],
          from: "non-existent-pin-uuid",
        };
      }

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error on self-loop wire", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      const pinUuid = snapshot.pinInstances.find(
        (pin) => pin.name === "x" && pin.type === PinInstanceType.Output,
      )?.uuid;

      if (pinUuid) {
        snapshot.wires.push({
          from: pinUuid,
          to: pinUuid,
        });
      }

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when wire.from is not Output/OutputExec", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
          },
          pinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      schema.wire(eventXPin!.uuid, addAPin!.uuid);
      const snapshot = schema.extract();

      // Меняем местами from и to (делаем Input -> Output)
      snapshot.wires[0] = {
        from: addAPin!.uuid,
        to: eventXPin!.uuid,
      };

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when Output connects to OutputExec", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: { next: {} },
        })
        .defineFunction("log", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: {} },
          execPinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          canAddExecPinIn: false,
          canAddExecPinOut: false,
          exec: async () => {},
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const log = schema.createFunction("log");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const logStartPin = schema
        .getNodePins(log.uuid)
        .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec);

      const snapshot = schema.extract();

      // Пытаемся соединить Output с InputExec
      snapshot.wires.push({
        from: eventXPin!.uuid,
        to: logStartPin!.uuid,
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when connecting pins from same node", () => {
      const commutator = Commutator.initialize().defineFunction("test", {
        pinsIn: {
          a: { type: CommonDataType.Number },
        },
        pinsOut: {
          b: { type: CommonDataType.Number },
        },
        execPinsIn: { start: {} },
        execPinsOut: {},
        canAddPinIn: false,
        canAddPinOut: false,
        canAddExecPinIn: false,
        canAddExecPinOut: false,
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      const test = schema.createFunction("test");

      const outputPin = schema
        .getNodePins(test.uuid)
        .find((pin) => pin.name === "b" && pin.type === PinInstanceType.Output);
      const inputPin = schema
        .getNodePins(test.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      const snapshot = schema.extract();

      // Пытаемся соединить пины из одной ноды
      snapshot.wires.push({
        from: outputPin!.uuid,
        to: inputPin!.uuid,
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error on type mismatch", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.String },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
          },
          pinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      const snapshot = schema.extract();

      // Пытаемся соединить String с Number
      snapshot.wires.push({
        from: eventXPin!.uuid,
        to: addAPin!.uuid,
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should allow Any type to accept any type", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.String },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Any },
          },
          pinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      const snapshot = schema.extract();

      // Any должен принимать любой тип
      snapshot.wires.push({
        from: eventXPin!.uuid,
        to: addAPin!.uuid,
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).not.toThrow();
    });

    test("should throw error when OutputExec has multiple wires", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: {} },
        })
        .defineFunction("log1", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: {} },
          execPinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          canAddExecPinIn: false,
          canAddExecPinOut: false,
          exec: async () => {},
        })
        .defineFunction("log2", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: {} },
          execPinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          canAddExecPinIn: false,
          canAddExecPinOut: false,
          exec: async () => {},
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const log1 = schema.createFunction("log1");
      const log2 = schema.createFunction("log2");

      const eventNextPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec);
      const log1StartPin = schema
        .getNodePins(log1.uuid)
        .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec);
      const log2StartPin = schema
        .getNodePins(log2.uuid)
        .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec);

      schema.wire(eventNextPin!.uuid, log1StartPin!.uuid);
      const snapshot = schema.extract();

      // Пытаемся добавить второй провод от OutputExec
      snapshot.wires.push({
        from: eventNextPin!.uuid,
        to: log2StartPin!.uuid,
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when Input has multiple incoming wires", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick1", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        })
        .defineEvent("onClick2", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
          },
          pinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event1 = schema.createEvent("onClick1");
      const event2 = schema.createEvent("onClick2");
      const add = schema.createPureFunction("add");

      const event1XPin = schema
        .getNodePins(event1.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const event2XPin = schema
        .getNodePins(event2.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      schema.wire(event1XPin!.uuid, addAPin!.uuid);
      const snapshot = schema.extract();

      // Пытаемся добавить второй провод к Input
      snapshot.wires.push({
        from: event2XPin!.uuid,
        to: addAPin!.uuid,
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error on cyclic connection", () => {
      const commutator = Commutator.initialize()
        .defineFunction("A", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: {} },
          execPinsOut: { next: {} },
          canAddPinIn: false,
          canAddPinOut: false,
          canAddExecPinIn: false,
          canAddExecPinOut: false,
          exec: async () => {},
        })
        .defineFunction("B", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: {} },
          execPinsOut: { next: {} },
          canAddPinIn: false,
          canAddPinOut: false,
          canAddExecPinIn: false,
          canAddExecPinOut: false,
          exec: async () => {},
        });

      const schema = commutator.createSchema();
      const a = schema.createFunction("A");
      const b = schema.createFunction("B");

      const aNextPin = schema
        .getNodePins(a.uuid)
        .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec);
      const bStartPin = schema
        .getNodePins(b.uuid)
        .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec);
      const bNextPin = schema
        .getNodePins(b.uuid)
        .find((pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec);
      const aStartPin = schema
        .getNodePins(a.uuid)
        .find((pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec);

      schema.wire(aNextPin!.uuid, bStartPin!.uuid);
      const snapshot = schema.extract();

      // Создаем цикл: A -> B -> A
      snapshot.wires.push({
        from: bNextPin!.uuid,
        to: aStartPin!.uuid,
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when pinType does not exist in DataTypes", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Изменяем pinType на несуществующий тип
      const pin = snapshot.pinInstances.find(
        (pin) => pin.name === "x" && pin.type === PinInstanceType.Output,
      );
      if (pin) {
        pin.pinType = "NonExistentType" as any;
      }

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when data pin has null pinType", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Устанавливаем pinType в null для data пина
      const pin = snapshot.pinInstances.find(
        (pin) => pin.name === "x" && pin.type === PinInstanceType.Output,
      );
      if (pin) {
        pin.pinType = null;
      }

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when exec pin has invalid pinType", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: { next: {} },
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Устанавливаем невалидный pinType для exec пина
      const pin = snapshot.pinInstances.find(
        (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
      );
      if (pin) {
        pin.pinType = CommonDataType.Number;
      }

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error on duplicate wire", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
          },
          pinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      schema.wire(eventXPin!.uuid, addAPin!.uuid);
      const snapshot = schema.extract();

      // Добавляем дубликат провода
      snapshot.wires.push({
        from: eventXPin!.uuid,
        to: addAPin!.uuid,
      });

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    test("should throw error when node config is invalid", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: {},
        config: {
          type: CommonDataType.Object,
          properties: {
            count: { type: CommonDataType.Number },
          },
        },
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick", { count: 5 });
      const snapshot = schema.extract();

      // Изменяем config на невалидный
      if (snapshot.events[0]) {
        snapshot.events[0] = {
          ...snapshot.events[0],
          config: { count: "invalid" },
        };
      }

      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
      }).toThrow(CommutatorError);
    });

    // КРИТИЧЕСКИ ВАЖНО: Тесты на попытки обхода валидации
    describe("security - bypass attempts", () => {
      test("should reject invalid snapshot when creating schema through initialize", () => {
        const commutator1 = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: {},
        });

        const schema1 = commutator1.createSchema();
        schema1.createEvent("onClick");
        const snapshot = schema1.extract();

        const commutator2 = Commutator.initialize().defineEvent("onHover", {
          pinsOut: {},
          execPinsOut: {},
        });

        // Попытка создать схему с невалидным снапшотом
        expect(() => {
          commutator2.createSchema(snapshot);
        }).toThrow(CommutatorError);
      });

      test("should reject snapshot with all violations simultaneously", () => {
        const commutator = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        });

        const schema = commutator.createSchema();
        schema.createEvent("onClick");
        const snapshot = schema.extract();

        // Максимально испорченный снапшот
        if (snapshot.events[0] && snapshot.pinInstances[0]) {
          snapshot.events.push({ ...snapshot.events[0] }); // Дубликат UUID
          snapshot.pinInstances.push({ ...snapshot.pinInstances[0] }); // Дубликат пина
        }
        // @ts-expect-error игнорируем ошибку потому что намеренно портим снапшот
        snapshot.pinInstances[0].nodeUuid = "non-existent"; // Пин без ноды
        snapshot.wires.push({
          from: "non-existent-from",
          to: "non-existent-to",
        }); // Провода с несуществующими пинами
        snapshot.wires.push({
          from: snapshot.pinInstances[1]?.uuid || "x",
          to: snapshot.pinInstances[1]?.uuid || "x",
        }); // Self-loop

        expect(() => {
          SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
        }).toThrow(CommutatorError);
      });

      test("should reject snapshot with null/undefined values", () => {
        const commutator = Commutator.initialize();
        const snapshot: any = {
          events: [null],
          refs: [undefined],
          pureFunctions: [],
          functions: [],
          pinInstances: [],
          wires: [],
        };

        expect(() => {
          SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
        }).toThrow(CommutatorError);
      });

      test("should reject snapshot with invalid node instance structure", () => {
        const commutator = Commutator.initialize();
        const snapshot: any = {
          events: [{ uuid: null, type: NodeType.Event, name: "test" }],
          refs: [],
          pureFunctions: [],
          functions: [],
          pinInstances: [],
          wires: [],
        };

        expect(() => {
          SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
        }).toThrow(CommutatorError);
      });

      test("should reject snapshot with invalid pin instance structure", () => {
        const commutator = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: {},
        });

        const schema = commutator.createSchema();
        schema.createEvent("onClick");
        const snapshot = schema.extract();

        if (snapshot.events[0]) {
          snapshot.pinInstances.push({
            uuid: null as any,
            nodeUuid: snapshot.events[0].uuid,
            type: PinInstanceType.Output,
            name: "test",
            pinType: CommonDataType.Number,
          });
        }

        expect(() => {
          SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
        }).toThrow(CommutatorError);
      });

      test("should reject snapshot with invalid wire structure", () => {
        const commutator = Commutator.initialize().defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: {},
        });

        const schema = commutator.createSchema();
        schema.createEvent("onClick");
        const snapshot = schema.extract();

        snapshot.wires.push({
          from: null as any,
          to: undefined as any,
        });

        expect(() => {
          SchemaValidator.validateSnapshot(snapshot, commutator["config"]);
        }).toThrow(CommutatorError);
      });
    });
  });

  describe("validateWire", () => {
    test("should validate valid wire", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
          },
          pinsOut: {},
          canAddPinIn: false,
          canAddPinOut: false,
          exec: async () => ({}),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      const allNodesMap = new Map();
      allNodesMap.set(event.uuid, event);
      allNodesMap.set(add.uuid, add);

      expect(() => {
        SchemaValidator.validateWire(
          eventXPin!,
          addAPin!,
          [],
          schema["pinInstances"],
          allNodesMap,
          commutator["config"],
        );
      }).not.toThrow();
    });

    test("should throw error on self-loop", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);

      const allNodesMap = new Map();
      allNodesMap.set(event.uuid, event);

      expect(() => {
        SchemaValidator.validateWire(
          eventXPin!,
          eventXPin!,
          [],
          schema["pinInstances"],
          allNodesMap,
          commutator["config"],
        );
      }).toThrow(CommutatorError);
    });
  });

  describe("validateAddPin", () => {
    test("should validate valid pin addition", () => {
      const commutator = Commutator.initialize().defineFunction("test", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: {},
        execPinsOut: {},
        canAddPinIn: true,
        canAddPinOut: false,
        canAddExecPinIn: false,
        canAddExecPinOut: false,
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      const test = schema.createFunction("test");

      const nodeConfig = commutator["config"].getNodeConfigByName("test");

      expect(() => {
        SchemaValidator.validateAddPin(
          test.uuid,
          "newPin",
          PinInstanceType.Input,
          CommonDataType.Number,
          nodeConfig!,
          schema["pinInstances"],
        );
      }).not.toThrow();
    });

    test("should throw error when canAddPinIn is false", () => {
      const commutator = Commutator.initialize().defineFunction("test", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: {},
        execPinsOut: {},
        canAddPinIn: false,
        canAddPinOut: false,
        canAddExecPinIn: false,
        canAddExecPinOut: false,
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      const test = schema.createFunction("test");

      const nodeConfig = commutator["config"].getNodeConfigByName("test");

      expect(() => {
        SchemaValidator.validateAddPin(
          test.uuid,
          "newPin",
          PinInstanceType.Input,
          CommonDataType.Number,
          nodeConfig!,
          schema["pinInstances"],
        );
      }).toThrow(CommutatorError);
    });
  });

  describe("validateRemovePin", () => {
    test("should validate valid pin removal", () => {
      const commutator = Commutator.initialize().defineFunction("test", {
        pinsIn: {
          a: { type: CommonDataType.Number },
          b: { type: CommonDataType.Number },
        },
        pinsOut: {},
        execPinsIn: {},
        execPinsOut: {},
        canAddPinIn: true,
        canAddPinOut: false,
        canAddExecPinIn: false,
        canAddExecPinOut: false,
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      const test = schema.createFunction("test");

      const pin = schema
        .getNodePins(test.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      const nodeConfig = commutator["config"].getNodeConfigByName("test");

      expect(() => {
        SchemaValidator.validateRemovePin(pin!, nodeConfig!, schema["pinInstances"]);
      }).not.toThrow();
    });

    test("should throw error when trying to remove last pin", () => {
      const commutator = Commutator.initialize().defineFunction("test", {
        pinsIn: {
          a: { type: CommonDataType.Number },
        },
        pinsOut: {},
        execPinsIn: {},
        execPinsOut: {},
        canAddPinIn: true,
        canAddPinOut: false,
        canAddExecPinIn: false,
        canAddExecPinOut: false,
        exec: async () => {},
      });

      const schema = commutator.createSchema();
      const test = schema.createFunction("test");

      const pin = schema
        .getNodePins(test.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      const nodeConfig = commutator["config"].getNodeConfigByName("test");

      expect(() => {
        SchemaValidator.validateRemovePin(pin!, nodeConfig!, schema["pinInstances"]);
      }).toThrow(CommutatorError);
    });
  });

  describe("validateUpdateNodeConfig", () => {
    test("should validate valid config update", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: {},
        config: {
          type: CommonDataType.Object,
          properties: {
            count: { type: CommonDataType.Number },
          },
        },
      });

      const schema = commutator.createSchema();
      const nodeConfig = commutator["config"].getNodeConfigByName("onClick");
      const validator = new (commutator["validator"].constructor as any)(commutator["config"].dataTypes);

      expect(() => {
        SchemaValidator.validateUpdateNodeConfig(nodeConfig!, { count: 5 }, validator);
      }).not.toThrow();
    });

    test("should throw error on invalid config", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: {},
        config: {
          type: CommonDataType.Object,
          properties: {
            count: { type: CommonDataType.Number },
          },
        },
      });

      const schema = commutator.createSchema();
      const nodeConfig = commutator["config"].getNodeConfigByName("onClick");
      const validator = new (commutator["validator"].constructor as any)(commutator["config"].dataTypes);

      expect(() => {
        SchemaValidator.validateUpdateNodeConfig(nodeConfig!, { count: "invalid" }, validator);
      }).toThrow(CommutatorError);
    });
  });

  describe("UUID/ULID validation", () => {
    test("should reject node with invalid UUID format", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: { next: {} },
      });

      const snapshot: SchemaSnapshot = {
        events: [
          {
            uuid: "invalid-uuid-format",
            type: NodeType.Event,
            name: "onClick",
            x: 0,
            y: 0,
          },
        ],
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [],
        wires: [],
      };

      const schema = commutator.createSchema();
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, schema["config"]);
      }).toThrow('is not a valid UUID or ULID');
    });

    test("should reject pin with invalid UUID format", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: { x: { type: CommonDataType.Number } },
        execPinsOut: { next: {} },
      });

      const eventUuid = ulid();
      const snapshot: SchemaSnapshot = {
        events: [
          {
            uuid: eventUuid,
            type: NodeType.Event,
            name: "onClick",
            x: 0,
            y: 0,
          },
        ],
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [
          {
            uuid: "not-a-valid-uuid",
            nodeUuid: eventUuid,
            type: PinInstanceType.Output,
            name: "x",
            pinType: CommonDataType.Number,
          },
        ],
        wires: [],
      };

      const schema = commutator.createSchema();
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, schema["config"]);
      }).toThrow('is not a valid UUID or ULID');
    });

    test("should reject pin with invalid nodeUuid format", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: { x: { type: CommonDataType.Number } },
        execPinsOut: { next: {} },
      });

      const pinUuid = ulid();
      const snapshot: SchemaSnapshot = {
        events: [
          {
            uuid: "invalid-node-uuid",
            type: NodeType.Event,
            name: "onClick",
            x: 0,
            y: 0,
          },
        ],
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [
          {
            uuid: pinUuid,
            nodeUuid: "invalid-node-uuid",
            type: PinInstanceType.Output,
            name: "x",
            pinType: CommonDataType.Number,
          },
        ],
        wires: [],
      };

      const schema = commutator.createSchema();
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, schema["config"]);
      }).toThrow('is not a valid UUID or ULID');
    });

    test("should reject wire with invalid from UUID format", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: { x: { type: CommonDataType.Number } },
        execPinsOut: { next: {} },
      });

      const eventUuid = ulid();
      const pinUuid = ulid();
      const snapshot: SchemaSnapshot = {
        events: [
          {
            uuid: eventUuid,
            type: NodeType.Event,
            name: "onClick",
            x: 0,
            y: 0,
          },
        ],
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [
          {
            uuid: pinUuid,
            nodeUuid: eventUuid,
            type: PinInstanceType.Output,
            name: "x",
            pinType: CommonDataType.Number,
          },
        ],
        wires: [
          {
            from: "invalid-from-uuid",
            to: pinUuid,
          },
        ],
      };

      const schema = commutator.createSchema();
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, schema["config"]);
      }).toThrow('is not a valid UUID or ULID');
    });

    test("should reject wire with invalid to UUID format", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: { x: { type: CommonDataType.Number } },
        execPinsOut: { next: {} },
      });

      const eventUuid = ulid();
      const pinUuid = ulid();
      const snapshot: SchemaSnapshot = {
        events: [
          {
            uuid: eventUuid,
            type: NodeType.Event,
            name: "onClick",
            x: 0,
            y: 0,
          },
        ],
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [
          {
            uuid: pinUuid,
            nodeUuid: eventUuid,
            type: PinInstanceType.Output,
            name: "x",
            pinType: CommonDataType.Number,
          },
        ],
        wires: [
          {
            from: pinUuid,
            to: "invalid-to-uuid",
          },
        ],
      };

      const schema = commutator.createSchema();
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, schema["config"]);
      }).toThrow('is not a valid UUID or ULID');
    });

    test("should accept valid ULID format", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: { next: {} },
      });

      const validUlid = ulid();
      const snapshot: SchemaSnapshot = {
        events: [
          {
            uuid: validUlid,
            type: NodeType.Event,
            name: "onClick",
            x: 0,
            y: 0,
          },
        ],
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [],
        wires: [],
      };

      const schema = commutator.createSchema();
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, schema["config"]);
      }).not.toThrow();
    });

    test("should accept valid UUID format with hyphens", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: { next: {} },
      });

      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      const snapshot: SchemaSnapshot = {
        events: [
          {
            uuid: validUuid,
            type: NodeType.Event,
            name: "onClick",
            x: 0,
            y: 0,
          },
        ],
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [],
        wires: [],
      };

      const schema = commutator.createSchema();
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, schema["config"]);
      }).not.toThrow();
    });

    test("should accept valid UUID format without hyphens", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: { next: {} },
      });

      const validUuid = "550e8400e29b41d4a716446655440000";
      const snapshot: SchemaSnapshot = {
        events: [
          {
            uuid: validUuid,
            type: NodeType.Event,
            name: "onClick",
            x: 0,
            y: 0,
          },
        ],
        refs: [],
        pureFunctions: [],
        functions: [],
        pinInstances: [],
        wires: [],
      };

      const schema = commutator.createSchema();
      expect(() => {
        SchemaValidator.validateSnapshot(snapshot, schema["config"]);
      }).not.toThrow();
    });
  });
});

