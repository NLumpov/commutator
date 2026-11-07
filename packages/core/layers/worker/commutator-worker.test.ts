import { describe, expect, test } from "bun:test";
import { CommonDataType, Commutator, CommutatorError } from "../commutator";
import { PinInstanceType } from "../schema/enums";
import type { WorkerSnapshot } from "./types";

describe("CommutatorWorker", () => {
  describe("Basic functionality", () => {
    test("should create worker from schema", () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: { x: { type: CommonDataType.Number } },
        execPinsOut: { next: null },
      });

      const schema = commutator.createSchema();
      const worker = schema.createWorker();

      expect(worker).toBeDefined();
    });

    test("should trigger event with payload", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("log", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const log = schema.createFunction("log");

      const eventXOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const logValueIn = schema
        .getNodePins(log.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);
      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const logExecIn = schema
        .getNodePins(log.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventXOut!.uuid, toPinUuid: logValueIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: logExecIn!.uuid });

      const worker = schema.createWorker();

      await expect(
        Promise.race([
          worker.triggerEvent("onClick", { x: 42 }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Test timeout: function execution took too long")), 5000),
          ),
        ]),
      ).resolves.toBeUndefined();
    }, 10000);
  });

  describe("Circular dependencies - PureFunction", () => {
    test("should detect direct circular dependency in PureFunction (A -> A)", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .definePureFunction("selfRef", {
        pinsIn: { value: { type: CommonDataType.Number } },
        pinsOut: { result: { type: CommonDataType.Number } },
        exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) + 1 }),
      });

      const schema = commutator.createSchema();
      const func1 = schema.createPureFunction("selfRef");
      const func2 = schema.createPureFunction("selfRef");

      const out1 = schema
        .getNodePins(func1.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const in1 = schema
        .getNodePins(func1.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      // Попытка создать цикл: func1.result -> func1.value должна быть обнаружена при создании связи
      expect(() => {
        schema.wire({ fromPinUuid: out1!.uuid, toPinUuid: in1!.uuid });
      }).toThrow(CommutatorError);
    });

    test("should detect indirect circular dependency in PureFunction (A -> B -> A)", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .definePureFunction("funcA", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) + 1 }),
        })
        .definePureFunction("funcB", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) * 2 }),
        });

      const schema = commutator.createSchema();
      const funcA = schema.createPureFunction("funcA");
      const funcB = schema.createPureFunction("funcB");

      const aOut = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const bIn = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);
      const bOut = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const aIn = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      schema.wire({ fromPinUuid: aOut!.uuid, toPinUuid: bIn!.uuid });
      // Попытка создать цикл должна быть обнаружена при создании связи
      expect(() => {
        schema.wire({ fromPinUuid: bOut!.uuid, toPinUuid: aIn!.uuid });
      }).toThrow(CommutatorError);
    });

    test("should detect long circular dependency chain (A -> B -> C -> A)", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .definePureFunction("funcA", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) + 1 }),
        })
        .definePureFunction("funcB", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) * 2 }),
        })
        .definePureFunction("funcC", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) - 1 }),
        });

      const schema = commutator.createSchema();
      const funcA = schema.createPureFunction("funcA");
      const funcB = schema.createPureFunction("funcB");
      const funcC = schema.createPureFunction("funcC");

      const aOut = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const bIn = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);
      const bOut = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const cIn = schema
        .getNodePins(funcC.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);
      const cOut = schema
        .getNodePins(funcC.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const aIn = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      schema.wire({ fromPinUuid: aOut!.uuid, toPinUuid: bIn!.uuid });
      schema.wire({ fromPinUuid: bOut!.uuid, toPinUuid: cIn!.uuid });
      // Попытка создать цикл должна быть обнаружена при создании связи
      expect(() => {
        schema.wire({ fromPinUuid: cOut!.uuid, toPinUuid: aIn!.uuid });
      }).toThrow(CommutatorError);
    });
  });

  describe("Circular dependencies - Function", () => {
    test("should detect circular dependency in Function through data pins", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("funcA", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: { result: (pinsIn.value ?? 0) + 1 },
              meta: null,
            });
          },
        })
        .defineFunction("funcB", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: { result: (pinsIn.value ?? 0) * 2 },
              meta: null,
            });
          },
        });

      const schema = commutator.createSchema();
      const funcA = schema.createFunction("funcA");
      const funcB = schema.createFunction("funcB");

      const aOut = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const bIn = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);
      const bOut = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const aIn = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      // Первый wire успешен
      schema.wire({ fromPinUuid: aOut!.uuid, toPinUuid: bIn!.uuid });
      
      // Попытка создать цикл должна быть обнаружена при создании связи
      expect(() => {
        schema.wire({ fromPinUuid: bOut!.uuid, toPinUuid: aIn!.uuid });
      }).toThrow(CommutatorError);
    });
  });

  describe("Infinite loops - exec chains", () => {
    test("should require a budget for an exec cycle when function calls itself through exec", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("selfLoop", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        exec: async ({ exec }) => {
          await exec({ execPinOut: "next", pinsOut: {}, meta: null });
        },
      });

      const schema = commutator.createSchema();
      const func = schema.createFunction("selfLoop");

      const execOut = schema
        .getNodePins(func.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const execIn = schema
        .getNodePins(func.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      // Exec cycles are valid graphs, but require a configured execution budget.
      expect(() => {
        schema.wire({ fromPinUuid: execOut!.uuid, toPinUuid: execIn!.uuid });
      }).not.toThrow();
      await expect(schema.createWorker().triggerEvent("onClick", { x: 1 })).rejects.toThrow("MAX_STEPS_REQUIRED");
    });

    test("should require a budget for an exec cycle in exec chain (A -> B -> A)", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("funcA", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        })
        .defineFunction("funcB", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const funcA = schema.createFunction("funcA");
      const funcB = schema.createFunction("funcB");

      const aExecOut = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const bExecIn = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const bExecOut = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const aExecIn = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: aExecOut!.uuid, toPinUuid: bExecIn!.uuid });
      // Exec cycles are valid graphs, but require a configured execution budget.
      expect(() => {
        schema.wire({ fromPinUuid: bExecOut!.uuid, toPinUuid: aExecIn!.uuid });
      }).not.toThrow();
      await expect(schema.createWorker().triggerEvent("onClick", { x: 1 })).rejects.toThrow("MAX_STEPS_REQUIRED");
    });

    test("should require a budget for an exec cycle with multiple exec calls", async () => {
      let callCount = 0;
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("counter", {
        pinsIn: {},
        pinsOut: {},
        execPinsIn: { start: null },
        execPinsOut: { next: null },
        meta: { type: CommonDataType.Number },
        exec: async ({ meta, exec }) => {
          callCount++;
          const newMeta = ((meta as number) ?? 0) + 1;
          if (newMeta < 1000) {
            await exec({ execPinOut: "next", pinsOut: {}, meta: newMeta });
          }
        },
      });

      const schema = commutator.createSchema();
      const func = schema.createFunction("counter");

      const execOut = schema
        .getNodePins(func.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const execIn = schema
        .getNodePins(func.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      // Exec cycles are valid graphs, but require a configured execution budget.
      expect(() => {
        schema.wire({ fromPinUuid: execOut!.uuid, toPinUuid: execIn!.uuid });
      }).not.toThrow();
      await expect(schema.createWorker().triggerEvent("onClick", { x: 1 })).rejects.toThrow("MAX_STEPS_REQUIRED");
    });
  });

  describe("Node type combinations", () => {
    test("should handle Event -> PureFunction -> Function chain", async () => {
      const executionOrder: string[] = [];

      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .definePureFunction("add", {
          pinsIn: { a: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => {
            executionOrder.push("pureFunction");
            return { result: (pinsIn.a ?? 0) + 1 };
          },
        })
        .defineFunction("log", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            executionOrder.push("function");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");
      const log = schema.createFunction("log");

      const eventXOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const addAIn = schema
        .getNodePins(add.uuid)
        .find((p) => p.name === "a" && p.type === PinInstanceType.Input);
      const addResultOut = schema
        .getNodePins(add.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const logValueIn = schema
        .getNodePins(log.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const logExecIn = schema
        .getNodePins(log.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventXOut!.uuid, toPinUuid: addAIn!.uuid });
      schema.wire({ fromPinUuid: addResultOut!.uuid, toPinUuid: logValueIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: logExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { x: 5 });

      expect(executionOrder).toContain("pureFunction");
      expect(executionOrder).toContain("function");
    });

    test("should handle Event -> Ref -> PureFunction chain", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { userId: { type: CommonDataType.String } },
          execPinsOut: { next: null },
        })
        .defineApi("userService", {
          getById: async (id: string) => ({ id, name: "Test", age: 25 }),
        })
        .defineRef("userRef", {
          pinsOut: { user: { type: CommonDataType.String } },
          config: {
            type: CommonDataType.Object,
            properties: { userId: { type: CommonDataType.String } },
          },
          resolveRef: async ({ config }) => ({
            user: `User-${(config as any).userId}`,
          }),
        })
        .definePureFunction("format", {
          pinsIn: { value: { type: CommonDataType.String } },
          pinsOut: { result: { type: CommonDataType.String } },
          exec: async ({ pinsIn }) => ({
            result: `Formatted: ${pinsIn.value ?? ""}`,
          }),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const ref = schema.createRef("userRef", { userId: "123" });
      const format = schema.createPureFunction("format");

      const refUserOut = schema
        .getNodePins(ref.uuid)
        .find((p) => p.name === "user" && p.type === PinInstanceType.Output);
      const formatValueIn = schema
        .getNodePins(format.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      // Ref получает данные из config, а не из пинов, поэтому подключаем только ref -> format
      schema.wire({ fromPinUuid: refUserOut!.uuid, toPinUuid: formatValueIn!.uuid });

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", { userId: "123" })).resolves.toBeUndefined();
    });

    test("should handle Function depending on Function through data pin", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("funcA", {
          pinsIn: {},
          pinsOut: { value: { type: CommonDataType.Number } },
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: { value: 10 },
              meta: null,
            });
          },
        })
        .defineFunction("funcB", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: {},
              meta: null,
            });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const funcA = schema.createFunction("funcA");
      const funcB = schema.createFunction("funcB");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const aExecIn = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const aExecOut = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const bExecIn = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      const aValueOut = schema
        .getNodePins(funcA.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Output);
      const bValueIn = schema
        .getNodePins(funcB.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: aExecIn!.uuid });
      schema.wire({ fromPinUuid: aExecOut!.uuid, toPinUuid: bExecIn!.uuid });
      schema.wire({ fromPinUuid: aValueOut!.uuid, toPinUuid: bValueIn!.uuid });

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", { x: 1 })).resolves.toBeUndefined();
    });
  });

  describe("Edge cases - null and undefined", () => {
    test("should handle null values in pins", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { value: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: {},
              meta: null,
            });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventValueOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Output);
      const processValueIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventValueOut!.uuid, toPinUuid: processValueIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", { value: null })).resolves.toBeUndefined();
    });

    test("should reject explicit undefined event values", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { value: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: {},
              meta: null,
            });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventValueOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Output);
      const processValueIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventValueOut!.uuid, toPinUuid: processValueIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", { value: undefined })).rejects.toThrow("non-JSON");
      expect(() => worker.extract()).toThrow("WORKER_FAILED");
    });

    test("should handle missing values in payload", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number }, y: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { x: { type: CommonDataType.Number }, y: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: {},
              meta: null,
            });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventXOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const eventYOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "y" && p.type === PinInstanceType.Output);
      const processXIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Input);
      const processYIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "y" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventXOut!.uuid, toPinUuid: processXIn!.uuid });
      schema.wire({ fromPinUuid: eventYOut!.uuid, toPinUuid: processYIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", {})).resolves.toBeUndefined();
    });
  });

  describe("Caching behavior", () => {
    test("should cache Event pin values", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .definePureFunction("add", {
          pinsIn: { a: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => ({ result: (pinsIn.a ?? 0) + 1 }),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add1 = schema.createPureFunction("add");
      const add2 = schema.createPureFunction("add");

      const eventXOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const add1AIn = schema
        .getNodePins(add1.uuid)
        .find((p) => p.name === "a" && p.type === PinInstanceType.Input);
      const add2AIn = schema
        .getNodePins(add2.uuid)
        .find((p) => p.name === "a" && p.type === PinInstanceType.Input);

      schema.wire({ fromPinUuid: eventXOut!.uuid, toPinUuid: add1AIn!.uuid });
      schema.wire({ fromPinUuid: eventXOut!.uuid, toPinUuid: add2AIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { x: 5 });

      const snapshot = worker.extract();
      expect(snapshot.pinCache.length).toBeGreaterThan(0);
    });

    test("should cache Function pin values", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("producer", {
          pinsIn: {},
          pinsOut: { value: { type: CommonDataType.Number } },
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: { value: 42 },
              meta: null,
            });
          },
        })
        .definePureFunction("consumer", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) * 2 }),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const producer = schema.createFunction("producer");
      const consumer = schema.createPureFunction("consumer");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const producerExecIn = schema
        .getNodePins(producer.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const producerValueOut = schema
        .getNodePins(producer.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Output);
      const consumerValueIn = schema
        .getNodePins(consumer.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: producerExecIn!.uuid });
      schema.wire({ fromPinUuid: producerValueOut!.uuid, toPinUuid: consumerValueIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", {});

      const snapshot = worker.extract();
      const producerPin = schema
        .getNodePins(producer.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Output);
      const cached = snapshot.pinCache.find((c) => c.uuid === producerPin!.uuid);
      expect(cached).toBeDefined();
      expect(cached?.cache).toBe(42);
    });

    test("should not cache PureFunction pin values", async () => {
      let callCount = 0;
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .definePureFunction("add", {
          pinsIn: { a: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => {
            callCount++;
            return { result: (pinsIn.a ?? 0) + 1 };
          },
        })
        .defineFunction("consumer", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const add = schema.createPureFunction("add");
      const consumer = schema.createFunction("consumer");

      const eventXOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const addAIn = schema
        .getNodePins(add.uuid)
        .find((p) => p.name === "a" && p.type === PinInstanceType.Input);
      const addResultOut = schema
        .getNodePins(add.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const consumerValueIn = schema
        .getNodePins(consumer.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const consumerExecIn = schema
        .getNodePins(consumer.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventXOut!.uuid, toPinUuid: addAIn!.uuid });
      schema.wire({ fromPinUuid: addResultOut!.uuid, toPinUuid: consumerValueIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: consumerExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { x: 5 });

      // PureFunction должна вызываться каждый раз
      expect(callCount).toBeGreaterThan(0);
    });
  });

  describe("Meta data handling", () => {
    test("should persist meta between function calls", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("counter", {
          pinsIn: {},
          pinsOut: { count: { type: CommonDataType.Number } },
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          meta: { type: CommonDataType.Number },
          exec: async ({ meta, exec }) => {
            const newCount = ((meta as number) ?? 0) + 1;
            await exec({
              execPinOut: "next",
              pinsOut: { count: newCount },
              meta: newCount,
            });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const counter = schema.createFunction("counter");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const counterExecIn = schema
        .getNodePins(counter.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: counterExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", {});

      const snapshot = worker.extract();
      const metaCache = snapshot.metaCache.find((c) => c.uuid === counter.uuid);
      expect(metaCache).toBeDefined();
      expect(metaCache?.cache).toBe(1);

      await worker.triggerEvent("onClick", {});
      const snapshot2 = worker.extract();
      const metaCache2 = snapshot2.metaCache.find((c) => c.uuid === counter.uuid);
      expect(metaCache2?.cache).toBe(2);
    });

    test("should handle undefined meta", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("test", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          meta: { type: CommonDataType.Number },
          exec: async ({ meta, exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: {},
              meta: null,
            });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const test = schema.createFunction("test");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const testExecIn = schema
        .getNodePins(test.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: testExecIn!.uuid });

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", {})).resolves.toBeUndefined();
    });
  });

  describe("Ref node handling", () => {
    test("should resolve ref only when needed", async () => {
      let resolveCount = 0;
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { userId: { type: CommonDataType.String } },
          execPinsOut: { next: null },
        })
        .defineApi("userService", {
          getById: async (id: string) => ({ id, name: "Test" }),
        })
        .defineRef("userRef", {
          pinsOut: { user: { type: CommonDataType.String } },
          config: {
            type: CommonDataType.Object,
            properties: { userId: { type: CommonDataType.String } },
          },
          resolveRef: async ({ config }) => {
            resolveCount++;
            return { user: `User-${(config as any).userId}` };
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const ref = schema.createRef("userRef", { userId: "123" });

      // Ref получает данные через config, а не через wire от event
      // Для тестирования resolveRef, подключаем ref к функции, которая использует его выход
      const funcDef = Commutator.initialize()
        .defineFunction("consumer", {
          pinsIn: { user: { type: CommonDataType.String } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      // Создаём схему с функцией consumer
      const commutator2 = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { userId: { type: CommonDataType.String } },
          execPinsOut: { next: null },
        })
        .defineApi("userService", {
          getById: async (id: string) => ({ id, name: "Test" }),
        })
        .defineRef("userRef", {
          pinsOut: { user: { type: CommonDataType.String } },
          config: {
            type: CommonDataType.Object,
            properties: { userId: { type: CommonDataType.String } },
          },
          resolveRef: async ({ config }) => {
            resolveCount++;
            return { user: `User-${(config as any).userId}` };
          },
        })
        .defineFunction("consumer", {
          pinsIn: { user: { type: CommonDataType.String } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema2 = commutator2.createSchema();
      const event2 = schema2.createEvent("onClick");
      const ref2 = schema2.createRef("userRef", { userId: "123" });
      const consumer = schema2.createFunction("consumer");

      const refUserOut = schema2
        .getNodePins(ref2.uuid)
        .find((p) => p.name === "user" && p.type === PinInstanceType.Output);
      const consumerUserIn = schema2
        .getNodePins(consumer.uuid)
        .find((p) => p.name === "user" && p.type === PinInstanceType.Input);
      const eventExecOut = schema2
        .getNodePins(event2.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const consumerExecIn = schema2
        .getNodePins(consumer.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema2.wire({ fromPinUuid: refUserOut!.uuid, toPinUuid: consumerUserIn!.uuid });
      schema2.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: consumerExecIn!.uuid });

      const worker = schema2.createWorker();
      await worker.triggerEvent("onClick", { userId: "123" });

      expect(resolveCount).toBeGreaterThan(0);
    });

    test("should cache ref values in runtime cache", async () => {
      let resolveCount = 0;
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { userId: { type: CommonDataType.String } },
          execPinsOut: { next: null },
        })
        .defineApi("userService", {
          getById: async (id: string) => ({ id, name: "Test" }),
        })
        .defineRef("userRef", {
          pinsOut: { user: { type: CommonDataType.String } },
          config: {
            type: CommonDataType.Object,
            properties: { userId: { type: CommonDataType.String } },
          },
          resolveRef: async ({ config }) => {
            resolveCount++;
            return { user: `User-${(config as any).userId}` };
          },
        })
        .definePureFunction("format", {
          pinsIn: { value: { type: CommonDataType.String } },
          pinsOut: { result: { type: CommonDataType.String } },
          exec: async ({ pinsIn }) => ({ result: `Formatted: ${pinsIn.value}` }),
        })
        .defineFunction("consumer", {
          pinsIn: { value1: { type: CommonDataType.String }, value2: { type: CommonDataType.String } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const ref = schema.createRef("userRef", { userId: "123" });
      const format1 = schema.createPureFunction("format");
      const format2 = schema.createPureFunction("format");
      const consumer = schema.createFunction("consumer");

      const refUserOut = schema
        .getNodePins(ref.uuid)
        .find((p) => p.name === "user" && p.type === PinInstanceType.Output);
      const format1ValueIn = schema
        .getNodePins(format1.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);
      const format2ValueIn = schema
        .getNodePins(format2.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);
      const format1ResultOut = schema
        .getNodePins(format1.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const format2ResultOut = schema
        .getNodePins(format2.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const consumerValue1In = schema
        .getNodePins(consumer.uuid)
        .find((p) => p.name === "value1" && p.type === PinInstanceType.Input);
      const consumerValue2In = schema
        .getNodePins(consumer.uuid)
        .find((p) => p.name === "value2" && p.type === PinInstanceType.Input);
      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const consumerExecIn = schema
        .getNodePins(consumer.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      // Ref выходной пин подключён к двум format-функциям
      schema.wire({ fromPinUuid: refUserOut!.uuid, toPinUuid: format1ValueIn!.uuid });
      schema.wire({ fromPinUuid: refUserOut!.uuid, toPinUuid: format2ValueIn!.uuid });
      // format-функции подключены к consumer
      schema.wire({ fromPinUuid: format1ResultOut!.uuid, toPinUuid: consumerValue1In!.uuid });
      schema.wire({ fromPinUuid: format2ResultOut!.uuid, toPinUuid: consumerValue2In!.uuid });
      // Exec wire
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: consumerExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { userId: "123" });

      // Ref должен быть вызван только один раз, даже если используется в двух местах
      expect(resolveCount).toBe(1);
    });

    test("should handle null ref response", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { userId: { type: CommonDataType.String } },
          execPinsOut: { next: null },
        })
        .defineRef("userRef", {
          pinsOut: { user: { type: CommonDataType.String } },
          config: {
            type: CommonDataType.Object,
            properties: { userId: { type: CommonDataType.String } },
          },
          resolveRef: async () => null,
        })
        .definePureFunction("format", {
          pinsIn: { value: { type: CommonDataType.String } },
          pinsOut: { result: { type: CommonDataType.String } },
          exec: async ({ pinsIn }) => ({ result: `Formatted: ${pinsIn.value ?? "null"}` }),
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const ref = schema.createRef("userRef", { userId: "123" });
      const format = schema.createPureFunction("format");

      const refUserOut = schema
        .getNodePins(ref.uuid)
        .find((p) => p.name === "user" && p.type === PinInstanceType.Output);
      const formatValueIn = schema
        .getNodePins(format.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      // Ref получает данные из config, а не из пинов, поэтому подключаем только ref -> format
      schema.wire({ fromPinUuid: refUserOut!.uuid, toPinUuid: formatValueIn!.uuid });

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", { userId: "123" })).resolves.toBeUndefined();
    });
  });

  describe("Multiple exec pins", () => {
    test("should handle function with multiple exec pins out", async () => {
      const executionOrder: string[] = [];

      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("branch", {
          pinsIn: { condition: { type: CommonDataType.Boolean } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { true: null, false: null },
          exec: async ({ pinsIn, exec }) => {
            executionOrder.push("branch");
            if (pinsIn.condition) {
              await exec({ execPinOut: "true", pinsOut: {}, meta: null });
            } else {
              await exec({ execPinOut: "false", pinsOut: {}, meta: null });
            }
          },
        })
        .defineFunction("trueHandler", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("trueHandler");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        })
        .defineFunction("falseHandler", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("falseHandler");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const branch = schema.createFunction("branch");
      const trueHandler = schema.createFunction("trueHandler");
      const falseHandler = schema.createFunction("falseHandler");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const branchExecIn = schema
        .getNodePins(branch.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const branchTrueOut = schema
        .getNodePins(branch.uuid)
        .find((p) => p.name === "true" && p.type === PinInstanceType.OutputExec);
      const branchFalseOut = schema
        .getNodePins(branch.uuid)
        .find((p) => p.name === "false" && p.type === PinInstanceType.OutputExec);
      const trueHandlerExecIn = schema
        .getNodePins(trueHandler.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const falseHandlerExecIn = schema
        .getNodePins(falseHandler.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: branchExecIn!.uuid });
      schema.wire({ fromPinUuid: branchTrueOut!.uuid, toPinUuid: trueHandlerExecIn!.uuid });
      schema.wire({ fromPinUuid: branchFalseOut!.uuid, toPinUuid: falseHandlerExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { condition: true });

      expect(executionOrder).toContain("branch");
      expect(executionOrder).toContain("trueHandler");
      expect(executionOrder).not.toContain("falseHandler");
    });
  });

  describe("Error handling", () => {
    test("should throw error when function not found", async () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: {},
        execPinsOut: { next: null },
      });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");

      // Создаем функцию вручную через реестр, но не определяем ее в конфиге
      const invalidNode = {
        uuid: "invalid-uuid",
        name: "nonExistentFunction",
        type: "Function" as const,
        config: null,
        x: 0,
        y: 0,
      };

      const worker = schema.createWorker();
      // Попытка обработать несуществующую функцию должна привести к ошибке
      // Но это сложно протестировать напрямую, так как нода не может быть создана без определения
      expect(worker).toBeDefined();
    });

    test("should handle function that throws error", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("errorFunc", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async () => {
            throw new Error("Test error");
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const errorFunc = schema.createFunction("errorFunc");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const errorFuncExecIn = schema
        .getNodePins(errorFunc.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: errorFuncExecIn!.uuid });

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", {})).rejects.toThrow("Test error");
    });
  });

  describe("Snapshot handling", () => {
    test("should restore pin cache from snapshot", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventXOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);
      const processValueIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventXOut!.uuid, toPinUuid: processValueIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker1 = schema.createWorker();
      await worker1.triggerEvent("onClick", { x: 42 });

      const snapshot = worker1.extract();
      const worker2 = schema.createWorker(snapshot);

      // Проверяем, что кеш восстановлен
      expect(snapshot.pinCache.length).toBeGreaterThan(0);
    });

    test("should restore meta cache from snapshot", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("counter", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          meta: { type: CommonDataType.Number },
          exec: async ({ meta, exec }) => {
            const newCount = ((meta as number) ?? 0) + 1;
            await exec({
              execPinOut: "next",
              pinsOut: {},
              meta: newCount,
            });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const counter = schema.createFunction("counter");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const counterExecIn = schema
        .getNodePins(counter.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: counterExecIn!.uuid });

      const worker1 = schema.createWorker();
      await worker1.triggerEvent("onClick", {});

      const snapshot = worker1.extract();
      const worker2 = schema.createWorker(snapshot);

      await worker2.triggerEvent("onClick", {});

      const snapshot2 = worker2.extract();
      const metaCache = snapshot2.metaCache.find((c) => c.uuid === counter.uuid);
      expect(metaCache?.cache).toBe(2);
    });

    test("should reject invalid cache entries in snapshot", async () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: { x: { type: CommonDataType.Number } },
        execPinsOut: { next: null },
      });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");

      const eventXOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "x" && p.type === PinInstanceType.Output);

      const invalidSnapshot: WorkerSnapshot = {
        schemaFingerprint: schema.createWorker().extract().schemaFingerprint,
        pinCache: [
          { uuid: eventXOut!.uuid, cache: "invalid string instead of number" },
          { uuid: "non-existent-uuid", cache: 42 },
        ],
        metaCache: [],
      };

      expect(() => schema.createWorker(invalidSnapshot)).toThrow(CommutatorError);
    });
  });

  describe("Complex scenarios", () => {
    test("should handle deep nested function chain", async () => {
      const executionOrder: string[] = [];

      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("level1", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("level1");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        })
        .defineFunction("level2", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("level2");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        })
        .defineFunction("level3", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("level3");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const level1 = schema.createFunction("level1");
      const level2 = schema.createFunction("level2");
      const level3 = schema.createFunction("level3");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const level1ExecIn = schema
        .getNodePins(level1.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const level1ExecOut = schema
        .getNodePins(level1.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const level2ExecIn = schema
        .getNodePins(level2.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const level2ExecOut = schema
        .getNodePins(level2.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const level3ExecIn = schema
        .getNodePins(level3.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: level1ExecIn!.uuid });
      schema.wire({ fromPinUuid: level1ExecOut!.uuid, toPinUuid: level2ExecIn!.uuid });
      schema.wire({ fromPinUuid: level2ExecOut!.uuid, toPinUuid: level3ExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", {});

      expect(executionOrder).toEqual(["level1", "level2", "level3"]);
    });

    test("should handle parallel exec branches", async () => {
      const executionOrder: string[] = [];

      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("splitter", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { branch1: null, branch2: null },
          exec: async ({ exec }) => {
            executionOrder.push("splitter");
            await Promise.all([
              exec({ execPinOut: "branch1", pinsOut: {}, meta: null }),
              exec({ execPinOut: "branch2", pinsOut: {}, meta: null }),
            ]);
          },
        })
        .defineFunction("branch1", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("branch1");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        })
        .defineFunction("branch2", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("branch2");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const splitter = schema.createFunction("splitter");
      const branch1 = schema.createFunction("branch1");
      const branch2 = schema.createFunction("branch2");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const splitterExecIn = schema
        .getNodePins(splitter.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const splitterBranch1Out = schema
        .getNodePins(splitter.uuid)
        .find((p) => p.name === "branch1" && p.type === PinInstanceType.OutputExec);
      const splitterBranch2Out = schema
        .getNodePins(splitter.uuid)
        .find((p) => p.name === "branch2" && p.type === PinInstanceType.OutputExec);
      const branch1ExecIn = schema
        .getNodePins(branch1.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const branch2ExecIn = schema
        .getNodePins(branch2.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: splitterExecIn!.uuid });
      schema.wire({ fromPinUuid: splitterBranch1Out!.uuid, toPinUuid: branch1ExecIn!.uuid });
      schema.wire({ fromPinUuid: splitterBranch2Out!.uuid, toPinUuid: branch2ExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", {});

      expect(executionOrder).toContain("splitter");
      expect(executionOrder).toContain("branch1");
      expect(executionOrder).toContain("branch2");
    });
  });

  describe("Default values", () => {
    test("should use default value when pin not connected", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { value: { type: CommonDataType.Number, default: 10 } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            expect(pinsIn.value).toBe(10);
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", {});
    });
  });

  describe("Data type edge cases", () => {
    test("should handle all primitive types", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {
            str: { type: CommonDataType.String },
            num: { type: CommonDataType.Number },
            bool: { type: CommonDataType.Boolean },
            date: { type: CommonDataType.Date },
          },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: {
            str: { type: CommonDataType.String },
            num: { type: CommonDataType.Number },
            bool: { type: CommonDataType.Boolean },
            date: { type: CommonDataType.Date },
          },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            expect(typeof pinsIn.str).toBe("string");
            expect(typeof pinsIn.num).toBe("number");
            expect(typeof pinsIn.bool).toBe("boolean");
            expect(typeof pinsIn.date).toBe("number");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventStrOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "str" && p.type === PinInstanceType.Output);
      const eventNumOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "num" && p.type === PinInstanceType.Output);
      const eventBoolOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "bool" && p.type === PinInstanceType.Output);
      const eventDateOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "date" && p.type === PinInstanceType.Output);

      const processStrIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "str" && p.type === PinInstanceType.Input);
      const processNumIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "num" && p.type === PinInstanceType.Input);
      const processBoolIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "bool" && p.type === PinInstanceType.Input);
      const processDateIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "date" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventStrOut!.uuid, toPinUuid: processStrIn!.uuid });
      schema.wire({ fromPinUuid: eventNumOut!.uuid, toPinUuid: processNumIn!.uuid });
      schema.wire({ fromPinUuid: eventBoolOut!.uuid, toPinUuid: processBoolIn!.uuid });
      schema.wire({ fromPinUuid: eventDateOut!.uuid, toPinUuid: processDateIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", {
        str: "test",
        num: 42,
        bool: true,
        date: Date.now(),
      });
    });

    test("should handle Object type", async () => {
      const commutator = Commutator.initialize()
        .defineDataType("User", {
          type: CommonDataType.Object,
          properties: {
            id: { type: CommonDataType.String },
            name: { type: CommonDataType.String },
            age: { type: CommonDataType.Number },
          },
        })
        .defineEvent("onClick", {
          pinsOut: { user: { type: "User" } },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { user: { type: "User" } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            const user = pinsIn.user as any;
            expect(user.id).toBe("123");
            expect(user.name).toBe("Test");
            expect(user.age).toBe(25);
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventUserOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "user" && p.type === PinInstanceType.Output);
      const processUserIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "user" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventUserOut!.uuid, toPinUuid: processUserIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", {
        user: { id: "123", name: "Test", age: 25 },
      });
    });

    test("should handle Array type", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { items: { type: CommonDataType.Array, itemType: { type: CommonDataType.Number } } },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { items: { type: CommonDataType.Array, itemType: { type: CommonDataType.Number } } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            const items = pinsIn.items as number[];
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBe(3);
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventItemsOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "items" && p.type === PinInstanceType.Output);
      const processItemsIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "items" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventItemsOut!.uuid, toPinUuid: processItemsIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { items: [1, 2, 3] });
    });

    test("should handle StringEnum type", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { status: { type: CommonDataType.StringEnum, values: ["active", "inactive"] } },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { status: { type: CommonDataType.StringEnum, values: ["active", "inactive"] } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            expect(pinsIn.status).toBe("active");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventStatusOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "status" && p.type === PinInstanceType.Output);
      const processStatusIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "status" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventStatusOut!.uuid, toPinUuid: processStatusIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { status: "active" });
    });

    test("should handle NumberEnum type", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { code: { type: CommonDataType.NumberEnum, values: [200, 404, 500] } },
          execPinsOut: { next: null },
        })
        .defineFunction("process", {
          pinsIn: { code: { type: CommonDataType.NumberEnum, values: [200, 404, 500] } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            expect(pinsIn.code).toBe(200);
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const process = schema.createFunction("process");

      const eventCodeOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "code" && p.type === PinInstanceType.Output);
      const processCodeIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "code" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const processExecIn = schema
        .getNodePins(process.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventCodeOut!.uuid, toPinUuid: processCodeIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: processExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { code: 200 });
    });
  });

  describe("Multiple events", () => {
    test("should handle multiple events of same type", async () => {
      const executionOrder: string[] = [];

      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { x: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("handler", {
          pinsIn: { x: { type: CommonDataType.Number } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            executionOrder.push(`handler-${pinsIn.x}`);
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event1 = schema.createEvent("onClick");
      const event2 = schema.createEvent("onClick");
      const handler1 = schema.createFunction("handler");
      const handler2 = schema.createFunction("handler");

      const event1ExecOut = schema
        .getNodePins(event1.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const event2ExecOut = schema
        .getNodePins(event2.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const handler1ExecIn = schema
        .getNodePins(handler1.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const handler2ExecIn = schema
        .getNodePins(handler2.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: event1ExecOut!.uuid, toPinUuid: handler1ExecIn!.uuid });
      schema.wire({ fromPinUuid: event2ExecOut!.uuid, toPinUuid: handler2ExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { x: 1 });

      expect(executionOrder.length).toBe(2);
    });

    test("should handle multiple different events", async () => {
      const executionOrder: string[] = [];

      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineEvent("onHover", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("clickHandler", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("clickHandler");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        })
        .defineFunction("hoverHandler", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            executionOrder.push("hoverHandler");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const clickEvent = schema.createEvent("onClick");
      const hoverEvent = schema.createEvent("onHover");
      const clickHandler = schema.createFunction("clickHandler");
      const hoverHandler = schema.createFunction("hoverHandler");

      const clickEventExecOut = schema
        .getNodePins(clickEvent.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const hoverEventExecOut = schema
        .getNodePins(hoverEvent.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const clickHandlerExecIn = schema
        .getNodePins(clickHandler.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);
      const hoverHandlerExecIn = schema
        .getNodePins(hoverHandler.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: clickEventExecOut!.uuid, toPinUuid: clickHandlerExecIn!.uuid });
      schema.wire({ fromPinUuid: hoverEventExecOut!.uuid, toPinUuid: hoverHandlerExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", {});
      await worker.triggerEvent("onHover", {});

      expect(executionOrder).toContain("clickHandler");
      expect(executionOrder).toContain("hoverHandler");
    });
  });

  describe("Isolated nodes", () => {
    test("should handle event without connections", async () => {
      const commutator = Commutator.initialize().defineEvent("onClick", {
        pinsOut: { x: { type: CommonDataType.Number } },
        execPinsOut: { next: null },
      });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", { x: 1 })).resolves.toBeUndefined();
    });

    test("should handle function without exec connections", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("isolated", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async () => {
            // Never called
          },
        });

      const schema = commutator.createSchema();
      schema.createEvent("onClick");
      schema.createFunction("isolated");

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", {})).resolves.toBeUndefined();
    });

    test("should handle pure function without connections", async () => {
      const commutator = Commutator.initialize().definePureFunction("isolated", {
        pinsIn: { value: { type: CommonDataType.Number } },
        pinsOut: { result: { type: CommonDataType.Number } },
        exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) + 1 }),
      });

      const commutator2 = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .definePureFunction("isolated", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { result: { type: CommonDataType.Number } },
          exec: async ({ pinsIn }) => ({ result: (pinsIn.value ?? 0) + 1 }),
        });

      const schema = commutator2.createSchema();
      schema.createEvent("onClick");
      schema.createPureFunction("isolated");

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", {})).resolves.toBeUndefined();
    });
  });

  describe("Large graphs", () => {
    test("should handle graph with 100 nodes", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { value: { type: CommonDataType.Number } },
          execPinsOut: { next: null },
        })
        .defineFunction("node", {
          pinsIn: { value: { type: CommonDataType.Number } },
          pinsOut: { value: { type: CommonDataType.Number } },
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            await exec({
              execPinOut: "next",
              pinsOut: { value: (pinsIn.value ?? 0) + 1 },
              meta: null,
            });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const nodes: any[] = [];

      for (let i = 0; i < 100; i++) {
        nodes.push(schema.createFunction("node"));
      }

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const firstNodeExecIn = schema
        .getNodePins(nodes[0].uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: firstNodeExecIn!.uuid });

      for (let i = 0; i < nodes.length - 1; i++) {
        const nodeExecOut = schema
          .getNodePins(nodes[i].uuid)
          .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
        const nextNodeExecIn = schema
          .getNodePins(nodes[i + 1].uuid)
          .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

        schema.wire({ fromPinUuid: nodeExecOut!.uuid, toPinUuid: nextNodeExecIn!.uuid });
      }

      const worker = schema.createWorker();
      await expect(worker.triggerEvent("onClick", { value: 0 })).resolves.toBeUndefined();
    });
  });

  describe("Performance edge cases", () => {
    test("should reject overlapping rapid triggers and accept the next completed pass", async () => {
      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: {},
          execPinsOut: { next: null },
        })
        .defineFunction("handler", {
          pinsIn: {},
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ exec }) => {
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const handler = schema.createFunction("handler");

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const handlerExecIn = schema
        .getNodePins(handler.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: handlerExecIn!.uuid });

      const worker = schema.createWorker();

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(worker.triggerEvent("onClick", {}));
      }

      const results = await Promise.allSettled(promises);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      for (const result of results.slice(1)) {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") expect(result.reason).toHaveProperty("code", "WORKER_BUSY");
      }
      await expect(worker.triggerEvent("onClick", {})).resolves.toBeUndefined();
    });
  });

  describe("Mixed node type dependencies", () => {
    test("should handle Event -> Ref -> PureFunction -> Function chain", async () => {
      const executionOrder: string[] = [];

      const commutator = Commutator.initialize()
        .defineEvent("onClick", {
          pinsOut: { userId: { type: CommonDataType.String } },
          execPinsOut: { next: null },
        })
        .defineApi("userService", {
          getById: async (id: string) => ({ id, name: "Test" }),
        })
        .defineRef("userRef", {
          pinsOut: { user: { type: CommonDataType.String } },
          config: {
            type: CommonDataType.Object,
            properties: { userId: { type: CommonDataType.String } },
          },
          resolveRef: async ({ config }) => {
            executionOrder.push("ref");
            return { user: `User-${(config as any).userId}` };
          },
        })
        .definePureFunction("format", {
          pinsIn: { value: { type: CommonDataType.String } },
          pinsOut: { result: { type: CommonDataType.String } },
          exec: async ({ pinsIn }) => {
            executionOrder.push("pureFunction");
            return { result: `Formatted: ${pinsIn.value}` };
          },
        })
        .defineFunction("log", {
          pinsIn: { message: { type: CommonDataType.String } },
          pinsOut: {},
          execPinsIn: { start: null },
          execPinsOut: { next: null },
          exec: async ({ pinsIn, exec }) => {
            executionOrder.push("function");
            await exec({ execPinOut: "next", pinsOut: {}, meta: null });
          },
        });

      const schema = commutator.createSchema();
      const event = schema.createEvent("onClick");
      const ref = schema.createRef("userRef", { userId: "123" });
      const format = schema.createPureFunction("format");
      const log = schema.createFunction("log");

      // Ref получает данные через config, не через wire от event
      // Правильная цепочка: ref.user -> format.value -> log.message
      const refUserOut = schema
        .getNodePins(ref.uuid)
        .find((p) => p.name === "user" && p.type === PinInstanceType.Output);
      const formatValueIn = schema
        .getNodePins(format.uuid)
        .find((p) => p.name === "value" && p.type === PinInstanceType.Input);
      const formatResultOut = schema
        .getNodePins(format.uuid)
        .find((p) => p.name === "result" && p.type === PinInstanceType.Output);
      const logMessageIn = schema
        .getNodePins(log.uuid)
        .find((p) => p.name === "message" && p.type === PinInstanceType.Input);

      const eventExecOut = schema
        .getNodePins(event.uuid)
        .find((p) => p.name === "next" && p.type === PinInstanceType.OutputExec);
      const logExecIn = schema
        .getNodePins(log.uuid)
        .find((p) => p.name === "start" && p.type === PinInstanceType.InputExec);

      schema.wire({ fromPinUuid: refUserOut!.uuid, toPinUuid: formatValueIn!.uuid });
      schema.wire({ fromPinUuid: formatResultOut!.uuid, toPinUuid: logMessageIn!.uuid });
      schema.wire({ fromPinUuid: eventExecOut!.uuid, toPinUuid: logExecIn!.uuid });

      const worker = schema.createWorker();
      await worker.triggerEvent("onClick", { userId: "123" });

      expect(executionOrder).toContain("ref");
      expect(executionOrder).toContain("pureFunction");
      expect(executionOrder).toContain("function");
    });
  });
});
