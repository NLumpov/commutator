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

  describe("checkCyclesInGraph", () => {
    describe("exec wires", () => {
      test("should return false for empty graph", () => {
        const commutator = Commutator.initialize().defineFunction("A", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async () => {},
        });

        const schema = commutator.createSchema();
        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(false);
      });

      test("should return false for single node without connections", () => {
        const commutator = Commutator.initialize().defineFunction("A", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async () => {},
        });

        const schema = commutator.createSchema();
        schema.createFunction("A");
        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(false);
      });

      test("should return false for two nodes without connection", () => {
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
        schema.createFunction("A");
        schema.createFunction("B");
        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(false);
      });

      test("should return false for linear chain A -> B -> C", () => {
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
          })
          .defineFunction("C", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const c = schema.createFunction("C");

        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const cStartPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });
        schema.wire({ fromPinUuid: bNextPin!.uuid, toPinUuid: cStartPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(false);
      });

      test("should return false for diamond pattern (no cycle)", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next1: null, next2: null },
            exec: async () => {},
          })
          .defineFunction("B", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("C", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("D", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start1: null, start2: null },
            execPinsOut: {},
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const c = schema.createFunction("C");
        const d = schema.createFunction("D");

        // A -> B -> D
        // A -> C -> D (diamond pattern)
        const aNext1Pin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next1" && pin.type === PinInstanceType.OutputExec,
        );
        const aNext2Pin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next2" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const cStartPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const cNextPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const dStart1Pin = schema.getNodePins(d.uuid).find(
          (pin) => pin.name === "start1" && pin.type === PinInstanceType.InputExec,
        );
        const dStart2Pin = schema.getNodePins(d.uuid).find(
          (pin) => pin.name === "start2" && pin.type === PinInstanceType.InputExec,
        );

        schema.wire({ fromPinUuid: aNext1Pin!.uuid, toPinUuid: bStartPin!.uuid });
        schema.wire({ fromPinUuid: aNext2Pin!.uuid, toPinUuid: cStartPin!.uuid });
        schema.wire({ fromPinUuid: bNextPin!.uuid, toPinUuid: dStart1Pin!.uuid });
        schema.wire({ fromPinUuid: cNextPin!.uuid, toPinUuid: dStart2Pin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(false);
      });

      test("should return true for simple cycle A -> B -> A (manually constructed)", () => {
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

        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });

        const snapshot = schema.extract();

        // Manually add the cycle wire (B -> A)
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        snapshot.wires.push({ from: bNextPin!.uuid, to: aStartPin!.uuid });

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        // Manually construct wires registry to bypass validation
        const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);
        for (const wire of snapshot.wires) {
          wiresRegistry.addWire(wire, pinsRegistry);
        }

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(true);
      });

      test("should return true for longer cycle A -> B -> C -> A (manually constructed)", () => {
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
          })
          .defineFunction("C", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const c = schema.createFunction("C");

        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const cStartPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });
        schema.wire({ fromPinUuid: bNextPin!.uuid, toPinUuid: cStartPin!.uuid });

        const snapshot = schema.extract();

        // Manually add the cycle wire (C -> A)
        const cNextPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        snapshot.wires.push({ from: cNextPin!.uuid, to: aStartPin!.uuid });

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        // Manually construct wires registry to bypass validation
        const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);
        for (const wire of snapshot.wires) {
          wiresRegistry.addWire(wire, pinsRegistry);
        }

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(true);
      });

      test("should detect cycle in partial graph (one component cyclic, one acyclic)", () => {
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
          })
          .defineFunction("X", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("Y", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: {},
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const x = schema.createFunction("X");
        const y = schema.createFunction("Y");

        // Acyclic component: X -> Y
        const xNextPin = schema.getNodePins(x.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const yStartPin = schema.getNodePins(y.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        schema.wire({ fromPinUuid: xNextPin!.uuid, toPinUuid: yStartPin!.uuid });

        // Setup cyclic component: A -> B (will manually add B -> A)
        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });

        const snapshot = schema.extract();

        // Add cycle B -> A
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        snapshot.wires.push({ from: bNextPin!.uuid, to: aStartPin!.uuid });

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);
        for (const wire of snapshot.wires) {
          wiresRegistry.addWire(wire, pinsRegistry);
        }

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(true);
      });

      test("should return false for multiple disconnected acyclic components", () => {
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
            execPinsOut: {},
            exec: async () => {},
          })
          .defineFunction("X", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("Y", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: {},
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const x = schema.createFunction("X");
        const y = schema.createFunction("Y");

        // Component 1: A -> B
        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });

        // Component 2: X -> Y
        const xNextPin = schema.getNodePins(x.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const yStartPin = schema.getNodePins(y.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        schema.wire({ fromPinUuid: xNextPin!.uuid, toPinUuid: yStartPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(false);
      });
    });

    describe("data wires", () => {
      test("should return false for acyclic data connections", () => {
        const commutator = Commutator.initialize()
          .definePureFunction("A", {
            pinsIn: {},
            pinsOut: { value: { type: CommonDataType.Number } },
            exec: async () => ({ value: 1 }),
          })
          .definePureFunction("B", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            exec: async ({ pinsIn }) => ({ value: (pinsIn.input ?? 0) + 1 }),
          })
          .definePureFunction("C", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: {},
            exec: async () => ({}),
          });

        const schema = commutator.createSchema();
        const a = schema.createPureFunction("A");
        const b = schema.createPureFunction("B");
        const c = schema.createPureFunction("C");

        const aValuePin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const bInputPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );
        const bValuePin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const cInputPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );

        schema.wire({ fromPinUuid: aValuePin!.uuid, toPinUuid: bInputPin!.uuid });
        schema.wire({ fromPinUuid: bValuePin!.uuid, toPinUuid: cInputPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const hasCycle = wiresRegistry.hasCycle("data");

        expect(hasCycle).toBe(false);
      });

      test("should return true for cyclic data connections (manually constructed)", () => {
        const commutator = Commutator.initialize()
          .definePureFunction("A", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            exec: async ({ pinsIn }) => ({ value: (pinsIn.input ?? 0) + 1 }),
          })
          .definePureFunction("B", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            exec: async ({ pinsIn }) => ({ value: (pinsIn.input ?? 0) * 2 }),
          });

        const schema = commutator.createSchema();
        const a = schema.createPureFunction("A");
        const b = schema.createPureFunction("B");

        const aValuePin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const bInputPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );

        schema.wire({ fromPinUuid: aValuePin!.uuid, toPinUuid: bInputPin!.uuid });

        const snapshot = schema.extract();

        // Manually add cycle B -> A
        const bValuePin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const aInputPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );
        snapshot.wires.push({ from: bValuePin!.uuid, to: aInputPin!.uuid });

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);
        for (const wire of snapshot.wires) {
          wiresRegistry.addWire(wire, pinsRegistry);
        }

        const hasCycle = wiresRegistry.hasCycle("data");

        expect(hasCycle).toBe(true);
      });

      test("should ignore exec wires when checking data cycles", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: {},
            pinsOut: { value: { type: CommonDataType.Number } },
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("B", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");

        // Data wire: A -> B
        const aValuePin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const bInputPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );
        schema.wire({ fromPinUuid: aValuePin!.uuid, toPinUuid: bInputPin!.uuid });

        // Exec wire: A -> B
        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });

        const snapshot = schema.extract();

        // Add exec cycle B -> A (should not affect data cycle check)
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        snapshot.wires.push({ from: bNextPin!.uuid, to: aStartPin!.uuid });

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);
        for (const wire of snapshot.wires) {
          wiresRegistry.addWire(wire, pinsRegistry);
        }

        // Data graph should be acyclic
        const hasDataCycle = wiresRegistry.hasCycle("data");
        expect(hasDataCycle).toBe(false);

        // Exec graph has cycle
        const hasExecCycle = wiresRegistry.hasCycle("exec");
        expect(hasExecCycle).toBe(true);
      });
    });

    describe("complex scenarios", () => {
      test("should return true for self-referencing cycle on node level", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");

        const snapshot = schema.extract();

        // Self-loop on node level
        const aValuePin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const aInputPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );
        snapshot.wires.push({ from: aValuePin!.uuid, to: aInputPin!.uuid });

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);
        for (const wire of snapshot.wires) {
          wiresRegistry.addWire(wire, pinsRegistry);
        }

        const hasCycle = wiresRegistry.hasCycle("data");

        expect(hasCycle).toBe(true);
      });

      test("should handle graph with 5 nodes in cycle", () => {
        const commutator = Commutator.initialize()
          .defineFunction("N1", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("N2", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("N3", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("N4", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("N5", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const n1 = schema.createFunction("N1");
        const n2 = schema.createFunction("N2");
        const n3 = schema.createFunction("N3");
        const n4 = schema.createFunction("N4");
        const n5 = schema.createFunction("N5");

        // N1 -> N2 -> N3 -> N4 -> N5
        const nodes = [n1, n2, n3, n4, n5];
        for (let i = 0; i < nodes.length - 1; i++) {
          const currentNode = nodes[i];
          const nextNode = nodes[i + 1];
          if (!currentNode || !nextNode) continue;
          const nextPin = schema.getNodePins(currentNode.uuid).find(
            (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
          );
          const startPin = schema.getNodePins(nextNode.uuid).find(
            (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
          );
          schema.wire({ fromPinUuid: nextPin!.uuid, toPinUuid: startPin!.uuid });
        }

        const snapshot = schema.extract();

        // Add cycle N5 -> N1
        const n5NextPin = schema.getNodePins(n5.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const n1StartPin = schema.getNodePins(n1.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        snapshot.wires.push({ from: n5NextPin!.uuid, to: n1StartPin!.uuid });

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry([], pinsRegistry, nodesRegistry, commutator.validator);
        for (const wire of snapshot.wires) {
          wiresRegistry.addWire(wire, pinsRegistry);
        }

        const hasCycle = wiresRegistry.hasCycle("exec");

        expect(hasCycle).toBe(true);
      });
    });
  });

  describe("willCreateCycleInteractive", () => {
    describe("exec wires", () => {
      test("should return false when adding wire that doesn't create cycle", () => {
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
            execPinsOut: {},
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");

        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const willCreateCycle = wiresRegistry.willCreateCycle(
          aNextPin!,
          bStartPin!,
        );

        expect(willCreateCycle).toBe(false);
      });

      test("should return true for self-loop on same node", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");

        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const willCreateCycle = wiresRegistry.willCreateCycle(
          aNextPin!,
          aStartPin!,
        );

        expect(willCreateCycle).toBe(true);
      });

      test("should return true when adding wire would create simple cycle A -> B -> A", () => {
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

        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        // First add A -> B
        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Check if adding B -> A would create cycle
        const willCreateCycle = wiresRegistry.willCreateCycle(
          bNextPin!,
          aStartPin!,
        );

        expect(willCreateCycle).toBe(true);
      });

      test("should return true when adding wire would create longer cycle A -> B -> C -> A", () => {
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
          })
          .defineFunction("C", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const c = schema.createFunction("C");

        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const cStartPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const cNextPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        // Add A -> B -> C
        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });
        schema.wire({ fromPinUuid: bNextPin!.uuid, toPinUuid: cStartPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Check if adding C -> A would create cycle
        const willCreateCycle = wiresRegistry.willCreateCycle(
          cNextPin!,
          aStartPin!,
        );

        expect(willCreateCycle).toBe(true);
      });

      test("should return false when adding wire to disconnected component", () => {
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
          })
          .defineFunction("X", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("Y", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: {},
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const x = schema.createFunction("X");
        const y = schema.createFunction("Y");

        // Component 1: A -> B (cycle)
        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });

        // Component 2 is disconnected
        const xNextPin = schema.getNodePins(x.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const yStartPin = schema.getNodePins(y.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Adding X -> Y should not create cycle
        const willCreateCycle = wiresRegistry.willCreateCycle(
          xNextPin!,
          yStartPin!,
        );

        expect(willCreateCycle).toBe(false);
      });

      test("should return false when from pin doesn't exist", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");

        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const willCreateCycle = wiresRegistry.willCreateCycle(
          "non-existent-pin" as any,
          aStartPin!,
        );

        expect(willCreateCycle).toBe(false);
      });

      test("should return false when to pin doesn't exist", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");

        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const willCreateCycle = wiresRegistry.willCreateCycle(
          aNextPin!,
          "non-existent-pin" as any,
        );

        expect(willCreateCycle).toBe(false);
      });

      test("should detect cycle through multiple branches (diamond pattern closing to cycle)", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next1: null, next2: null },
            exec: async () => {},
          })
          .defineFunction("B", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("C", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("D", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start1: null, start2: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const c = schema.createFunction("C");
        const d = schema.createFunction("D");

        // A -> B -> D and A -> C -> D
        const aNext1Pin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next1" && pin.type === PinInstanceType.OutputExec,
        );
        const aNext2Pin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next2" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const cStartPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const cNextPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const dStart1Pin = schema.getNodePins(d.uuid).find(
          (pin) => pin.name === "start1" && pin.type === PinInstanceType.InputExec,
        );
        const dStart2Pin = schema.getNodePins(d.uuid).find(
          (pin) => pin.name === "start2" && pin.type === PinInstanceType.InputExec,
        );
        const dNextPin = schema.getNodePins(d.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        schema.wire({ fromPinUuid: aNext1Pin!.uuid, toPinUuid: bStartPin!.uuid });
        schema.wire({ fromPinUuid: aNext2Pin!.uuid, toPinUuid: cStartPin!.uuid });
        schema.wire({ fromPinUuid: bNextPin!.uuid, toPinUuid: dStart1Pin!.uuid });
        schema.wire({ fromPinUuid: cNextPin!.uuid, toPinUuid: dStart2Pin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Adding D -> A would create cycle through both branches
        const willCreateCycle = wiresRegistry.willCreateCycle(
          dNextPin!,
          aStartPin!,
        );

        expect(willCreateCycle).toBe(true);
      });
    });

    describe("data wires", () => {
      test("should return false when adding data wire that doesn't create cycle", () => {
        const commutator = Commutator.initialize()
          .definePureFunction("A", {
            pinsIn: {},
            pinsOut: { value: { type: CommonDataType.Number } },
            exec: async () => ({ value: 1 }),
          })
          .definePureFunction("B", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: {},
            exec: async () => ({}),
          });

        const schema = commutator.createSchema();
        const a = schema.createPureFunction("A");
        const b = schema.createPureFunction("B");

        const aValuePin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const bInputPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const willCreateCycle = wiresRegistry.willCreateCycle(
          aValuePin!,
          bInputPin!,
        );

        expect(willCreateCycle).toBe(false);
      });

      test("should return true for self-referencing data wire", () => {
        const commutator = Commutator.initialize()
          .definePureFunction("A", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            exec: async ({ pinsIn }) => ({ value: (pinsIn.input ?? 0) + 1 }),
          });

        const schema = commutator.createSchema();
        const a = schema.createPureFunction("A");

        const aValuePin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const aInputPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        const willCreateCycle = wiresRegistry.willCreateCycle(
          aValuePin!,
          aInputPin!,
        );

        expect(willCreateCycle).toBe(true);
      });

      test("should return true when adding data wire would create cycle", () => {
        const commutator = Commutator.initialize()
          .definePureFunction("A", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            exec: async ({ pinsIn }) => ({ value: (pinsIn.input ?? 0) + 1 }),
          })
          .definePureFunction("B", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            exec: async ({ pinsIn }) => ({ value: (pinsIn.input ?? 0) * 2 }),
          });

        const schema = commutator.createSchema();
        const a = schema.createPureFunction("A");
        const b = schema.createPureFunction("B");

        const aValuePin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const bInputPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );
        const bValuePin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const aInputPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );

        // Add A -> B
        schema.wire({ fromPinUuid: aValuePin!.uuid, toPinUuid: bInputPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Check if adding B -> A would create cycle
        const willCreateCycle = wiresRegistry.willCreateCycle(
          bValuePin!,
          aInputPin!,
        );

        expect(willCreateCycle).toBe(true);
      });

      test("should ignore exec wires when checking data cycle", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("B", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");

        // Exec wire B -> A
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        schema.wire({ fromPinUuid: bNextPin!.uuid, toPinUuid: aStartPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Adding data wire A -> B should not consider exec wires
        const aValuePin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const bInputPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );

        const willCreateCycle = wiresRegistry.willCreateCycle(
          aValuePin!,
          bInputPin!,
        );

        expect(willCreateCycle).toBe(false);
      });
    });

    describe("complex scenarios", () => {
      test("should detect cycle in complex graph with multiple paths", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next1: null, next2: null },
            exec: async () => {},
          })
          .defineFunction("B", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("C", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("D", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("E", {
            pinsIn: {},
            pinsOut: {},
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");
        const c = schema.createFunction("C");
        const d = schema.createFunction("D");
        const e = schema.createFunction("E");

        // A -> B -> D -> E
        // A -> C -> D -> E
        const aNext1Pin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next1" && pin.type === PinInstanceType.OutputExec,
        );
        const aNext2Pin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next2" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const bNextPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const cStartPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const cNextPin = schema.getNodePins(c.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const dStartPin = schema.getNodePins(d.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const dNextPin = schema.getNodePins(d.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const eStartPin = schema.getNodePins(e.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        const eNextPin = schema.getNodePins(e.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const aStartPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        schema.wire({ fromPinUuid: aNext1Pin!.uuid, toPinUuid: bStartPin!.uuid });
        schema.wire({ fromPinUuid: aNext2Pin!.uuid, toPinUuid: cStartPin!.uuid });
        schema.wire({ fromPinUuid: bNextPin!.uuid, toPinUuid: dStartPin!.uuid });
        // Note: C -> D would need another input pin, using same D for simplicity
        schema.wire({ fromPinUuid: dNextPin!.uuid, toPinUuid: eStartPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Adding E -> A would create a long cycle
        const willCreateCycle = wiresRegistry.willCreateCycle(
          eNextPin!,
          aStartPin!,
        );

        expect(willCreateCycle).toBe(true);
      });

      test("should not detect cycle for backward edge in different wire type", () => {
        const commutator = Commutator.initialize()
          .defineFunction("A", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          })
          .defineFunction("B", {
            pinsIn: { input: { type: CommonDataType.Number } },
            pinsOut: { value: { type: CommonDataType.Number } },
            execPinsIn: { start: null },
            execPinsOut: { next: null },
            exec: async () => {},
          });

        const schema = commutator.createSchema();
        const a = schema.createFunction("A");
        const b = schema.createFunction("B");

        // Exec: A -> B
        const aNextPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const bStartPin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );
        schema.wire({ fromPinUuid: aNextPin!.uuid, toPinUuid: bStartPin!.uuid });

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Adding data wire B -> A should not be affected by exec wire A -> B
        const bValuePin = schema.getNodePins(b.uuid).find(
          (pin) => pin.name === "value" && pin.type === PinInstanceType.Output,
        );
        const aInputPin = schema.getNodePins(a.uuid).find(
          (pin) => pin.name === "input" && pin.type === PinInstanceType.Input,
        );

        const willCreateCycle = wiresRegistry.willCreateCycle(
          bValuePin!,
          aInputPin!,
        );

        expect(willCreateCycle).toBe(false);
      });

      test("should handle large chain without false positive", () => {
        const commutator = Commutator.initialize()
          .defineFunction("N0", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N1", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N2", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N3", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N4", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N5", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N6", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N7", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N8", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N9", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: {}, exec: async () => {} });

        const schema = commutator.createSchema();
        const nodes = [
          schema.createFunction("N0"),
          schema.createFunction("N1"),
          schema.createFunction("N2"),
          schema.createFunction("N3"),
          schema.createFunction("N4"),
          schema.createFunction("N5"),
          schema.createFunction("N6"),
          schema.createFunction("N7"),
          schema.createFunction("N8"),
          schema.createFunction("N9"),
        ];

        // Create chain N0 -> N1 -> N2 -> ... -> N8
        for (let i = 0; i < nodes.length - 2; i++) {
          const currentNode = nodes[i];
          const nextNode = nodes[i + 1];
          if (!currentNode || !nextNode) continue;
          const nextPin = schema.getNodePins(currentNode.uuid).find(
            (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
          );
          const startPin = schema.getNodePins(nextNode.uuid).find(
            (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
          );
          schema.wire({ fromPinUuid: nextPin!.uuid, toPinUuid: startPin!.uuid });
        }

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Adding N8 -> N9 should not create cycle
        const n8 = nodes[8];
        const n9 = nodes[9];
        const n8NextPin = schema.getNodePins(n8!.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const n9StartPin = schema.getNodePins(n9!.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        const willCreateCycle = wiresRegistry.willCreateCycle(
          n8NextPin!,
          n9StartPin!,
        );

        expect(willCreateCycle).toBe(false);
      });

      test("should detect cycle when closing long chain", () => {
        const commutator = Commutator.initialize()
          .defineFunction("N0", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N1", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N2", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N3", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} })
          .defineFunction("N4", { pinsIn: {}, pinsOut: {}, execPinsIn: { start: null }, execPinsOut: { next: null }, exec: async () => {} });

        const schema = commutator.createSchema();
        const nodes = [
          schema.createFunction("N0"),
          schema.createFunction("N1"),
          schema.createFunction("N2"),
          schema.createFunction("N3"),
          schema.createFunction("N4"),
        ];

        // Create chain N0 -> N1 -> N2 -> N3 -> N4
        for (let i = 0; i < nodes.length - 1; i++) {
          const currentNode = nodes[i];
          const nextNode = nodes[i + 1];
          if (!currentNode || !nextNode) continue;
          const nextPin = schema.getNodePins(currentNode.uuid).find(
            (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
          );
          const startPin = schema.getNodePins(nextNode.uuid).find(
            (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
          );
          schema.wire({ fromPinUuid: nextPin!.uuid, toPinUuid: startPin!.uuid });
        }

        const snapshot = schema.extract();

        const nodesRegistry = new NodesRegistry(snapshot.nodes, commutator["config"], commutator.validator);
        const pinsRegistry = new PinsRegistry(snapshot.pinInstances, nodesRegistry, commutator.validator);
        const wiresRegistry = new WiresRegistry(snapshot.wires, pinsRegistry, nodesRegistry, commutator.validator);

        // Adding N4 -> N0 should create cycle
        const n4 = nodes[4];
        const n0 = nodes[0];
        const n4NextPin = schema.getNodePins(n4!.uuid).find(
          (pin) => pin.name === "next" && pin.type === PinInstanceType.OutputExec,
        );
        const n0StartPin = schema.getNodePins(n0!.uuid).find(
          (pin) => pin.name === "start" && pin.type === PinInstanceType.InputExec,
        );

        const willCreateCycle = wiresRegistry.willCreateCycle(
          n4NextPin!,
          n0StartPin!,
        );

        expect(willCreateCycle).toBe(true);
      });
    });
  });
});

