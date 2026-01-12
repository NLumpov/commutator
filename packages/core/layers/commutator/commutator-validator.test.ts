import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator, NodeType } from ".";
import { CommutatorError } from "./commutator-error";
import { ulid } from "../../util/ulid";
import { PinInstanceType } from "../schema/enums";
import { NodesRegistry } from "../schema/nodes-registry";
import { WiresRegistry } from "../schema/wires-registry";
import { PinsRegistry } from "../schema/pins-registry";
import type { SchemaSnapshot } from "../schema/types";

describe("CommutatorValidator", () => {
  describe("validateSnapshot", () => {
    test("should validate valid snapshot", () => {
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
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");

      const eventXPin = schema
        .getNodePins(event.uuid)
        .find((pin) => pin.name === "x" && pin.type === PinInstanceType.Output);
      const addAPin = schema
        .getNodePins(add.uuid)
        .find((pin) => pin.name === "a" && pin.type === PinInstanceType.Input);

      schema.wire({ fromPinUuid: eventXPin!.uuid, toPinUuid: addAPin!.uuid });

      const snapshot = schema.extract();

      expect(() => {
        commutator.createSchema(snapshot);
      }).not.toThrow();
    });

    test("should throw error when snapshot.nodes is not an array", () => {
      const commutator = Commutator.initialize();
      const snapshot: SchemaSnapshot = {
        nodes: null as any,
        pinInstances: [],
        wires: [],
      };
      expect(() => {
        commutator.createSchema(snapshot);
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
      snapshot.nodes.push({ ...event1.instance });

      expect(() => {
        commutator.createSchema(snapshot);
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
        commutator2.createSchema(snapshot);
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
        commutator.createSchema(snapshot);
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
        commutator.createSchema(snapshot);
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

      schema.wire({ fromPinUuid: eventXPin!.uuid, toPinUuid: addAPin!.uuid });
      const snapshot = schema.extract();

      // Изменяем UUID пина в проводе на несуществующий
      if (snapshot.wires[0]) {
        snapshot.wires[0] = {
          ...snapshot.wires[0],
          from: "non-existent-pin-uuid",
        };
      }

      expect(() => {
        commutator.createSchema(snapshot);
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
        commutator.createSchema(snapshot);
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

      schema.wire({ fromPinUuid: eventXPin!.uuid, toPinUuid: addAPin!.uuid });
      const snapshot = schema.extract();

      // Меняем местами from и to (делаем Input -> Output)
      snapshot.wires[0] = {
        from: addAPin!.uuid,
        to: eventXPin!.uuid,
      };

      expect(() => {
        commutator.createSchema(snapshot);
      }).toThrow(CommutatorError);
    });

    test("should throw error when Output connects to OutputExec", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Number },
          },
          execPinsOut: { next: null },
        })
        .defineFunction("log", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: {},
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
        commutator.createSchema(snapshot);
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
        execPinsIn: { start: null },
        execPinsOut: {},
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
        commutator.createSchema(snapshot);
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
        commutator.createSchema(snapshot);
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
        commutator.createSchema(snapshot);
      }).not.toThrow();
    });

    test("should throw error when output pin has Any type", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Any },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Number },
          },
          pinsOut: {},
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

      // Output Any не должен быть совместим ни с какими пинами
      snapshot.wires.push({
        from: eventXPin!.uuid,
        to: addAPin!.uuid,
      });

      expect(() => {
        commutator.createSchema(snapshot);
      }).toThrow(CommutatorError);
    });

    test("should allow Any type to connect to Any type", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            x: { type: CommonDataType.Any },
          },
          execPinsOut: {},
        })
        .definePureFunction("add", {
          pinsIn: {
            a: { type: CommonDataType.Any },
          },
          pinsOut: {},
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

      // Output Any должен быть совместим с input Any
      snapshot.wires.push({
        from: eventXPin!.uuid,
        to: addAPin!.uuid,
      });

      expect(() => {
        commutator.createSchema(snapshot);
      }).not.toThrow();
    });

    test("should throw error when OutputExec has multiple wires", () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("log1", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: {},
          exec: async () => {},
        })
        .defineFunction("log2", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: {},
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

      schema.wire({ fromPinUuid: eventNextPin!.uuid, toPinUuid: log1StartPin!.uuid });
      const snapshot = schema.extract();

      // Пытаемся добавить второй провод от OutputExec
      snapshot.wires.push({
        from: eventNextPin!.uuid,
        to: log2StartPin!.uuid,
      });

      expect(() => {
        commutator.createSchema(snapshot);
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

      schema.wire({ fromPinUuid: event1XPin!.uuid, toPinUuid: addAPin!.uuid });
      const snapshot = schema.extract();

      // Пытаемся добавить второй провод к Input
      snapshot.wires.push({
        from: event2XPin!.uuid,
        to: addAPin!.uuid,
      });

      expect(() => {
        commutator.createSchema(snapshot);
      }).toThrow(CommutatorError);
    });

    test("should throw error on cyclic connection", () => {
      const commutator = Commutator.initialize()
        .defineFunction("A", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async () => {},
        })
        .defineFunction("B", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
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

      schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });
      const snapshot = schema.extract();

      // Создаем цикл: A -> B -> A
      snapshot.wires.push({
        from: bNextPin!.uuid,
        to: aStartPin!.uuid,
      });

      expect(() => {
        commutator.createSchema(snapshot);
      }).toThrow(CommutatorError);
    });

    test("should throw error when dataType does not exist in DataTypes", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Изменяем dataType на несуществующий тип
      const pin = snapshot.pinInstances.find(
        (pin) => pin.name === "x" && pin.type === PinInstanceType.Output,
      );
      if (pin) {
        pin.dataType = { type: "NonExistentType" }
      }

      expect(() => {
        commutator.createSchema(snapshot);
      }).toThrow(CommutatorError);
    });

    test("should throw error when data pin has null dataType", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {
          x: { type: CommonDataType.Number },
        },
        execPinsOut: {},
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Устанавливаем dataType в null для data пина
      const pin = snapshot.pinInstances.find(
        (pin) => pin.name === "x" && pin.type === PinInstanceType.Output,
      );
      if (pin) {
        pin.dataType = null;
      }

      expect(() => {
          commutator.createSchema(snapshot);
      }).toThrow(CommutatorError);
    });

    test("should throw error when exec pin has invalid dataType", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: { next: null },
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      const snapshot = schema.extract();

      // Устанавливаем невалидный dataType для exec пина
      const pin = snapshot.pinInstances.find(
        (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
      );
      if (pin) {
        pin.dataType = { type: CommonDataType.Number };
      }

      expect(() => {
        commutator.createSchema(snapshot);
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

      schema.wire({ fromPinUuid: eventXPin!.uuid, toPinUuid: addAPin!.uuid });
      const snapshot = schema.extract();

      // Добавляем дубликат провода
      snapshot.wires.push({
        from: eventXPin!.uuid,
        to: addAPin!.uuid,
      });

      expect(() => {
        commutator.createSchema(snapshot);
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
      if (snapshot.nodes[0]) {
        snapshot.nodes[0] = {
          ...snapshot.nodes[0],
          config: { count: "invalid" },
        };
      }

      expect(() => {
        commutator.createSchema(snapshot);
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
        if (snapshot.nodes[0] && snapshot.pinInstances[0]) {
          snapshot.nodes.push({ ...snapshot.nodes[0] }); // Дубликат UUID
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
          commutator.createSchema(snapshot);
        }).toThrow(CommutatorError);
      });

      test("should reject snapshot with null/undefined values", () => {
        const commutator = Commutator.initialize();
        const snapshot: any = {
          nodes: [null],
          pinInstances: [],
          wires: [],
        };

        expect(() => {
          commutator.createSchema(snapshot);
        }).toThrow(CommutatorError);
      });

      test("should reject snapshot with invalid node instance structure", () => {
        const commutator = Commutator.initialize();
        const snapshot: any = {
          nodes: [{ uuid: null, type: NodeType.Event, name: "test" }],
          pinInstances: [],
          wires: [],
        };

        expect(() => {
          commutator.createSchema(snapshot);
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

        if (snapshot.nodes[0]) {
          snapshot.pinInstances.push({
            uuid: null as any,
            nodeUuid: snapshot.nodes[0].uuid,
            type: PinInstanceType.Output,
            name: "test",
            dataType: { type: CommonDataType.Number },
          });
        }

        expect(() => {
          commutator.createSchema(snapshot);
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
          commutator.createSchema(snapshot);
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

      const nodesRegistry = new NodesRegistry([event, add], commutator["config"], commutator.validator);
      const pinsRegistry = new PinsRegistry([eventXPin!, addAPin!], nodesRegistry, commutator.validator);
      const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);

      expect(() => {
        commutator.validator.validateWire(
          eventXPin!,
          addAPin!,
          wiresRegistry,
          nodesRegistry,
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

      const allPinsMap = new Map(
        schema.getNodePins(event.uuid).map((pin) => [pin.uuid, pin]),
      );

      const nodesRegistry = new NodesRegistry([event], commutator["config"], commutator.validator);
      const pinsRegistry = new PinsRegistry([eventXPin!], nodesRegistry, commutator.validator);
      const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);

      expect(() => {
        commutator.validator.validateWire(
          eventXPin!,
          eventXPin!,
          wiresRegistry,
          nodesRegistry,
        );
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

      expect(() => {
        commutator.validator.validateUpdateNodeConfig(nodeConfig!, { count: 5 });
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

      expect(() => {
        commutator.validator.validateUpdateNodeConfig(nodeConfig!, { count: "invalid" });
      }).toThrow(CommutatorError);
    });
  });
});

