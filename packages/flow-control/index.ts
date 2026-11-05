import { CommonDataType, Commutator, PinInstanceType } from "@commutator/core";

export const flowControlExtension = Commutator.initialize()
  .defineFunction("Branch", {
    pinsIn: { condition: { type: CommonDataType.Boolean } },
    pinsOut: {},
    execPinsIn: { "": null },
    execPinsOut: { A: null, B: null },
    exec: ({ pinsIn, exec }) =>
      exec({
        execPinOut: pinsIn.condition ? "A" : "B",
        pinsOut: {},
        meta: null,
      }),
  })
  .defineFunction("SwitchString", {
    pinsIn: { value: { type: CommonDataType.String } },
    pinsOut: {},
    execPinsIn: { "": null },
    execPinsOut: { Default: null },
    addExecPinOut: ({ actions }) => {
      const pins = actions.getAllPins();
      const execPinsOut = pins.filter((p) => p.type === PinInstanceType.OutputExec);

      const namesSet = new Set(execPinsOut.map((p) => p.name));
      let newName = `Case 1`;
      let nameIndex = 1;

      while (namesSet.has(newName)) {
        newName = `Case ${nameIndex}`;
        nameIndex++;
      }

      actions.addExecPin(newName, PinInstanceType.OutputExec);
    },
    exec: ({ pinsIn, execPinsOut, exec }) => {
      const availablePinsOutKeys = Object.keys(execPinsOut);

      const pinToTrigger = availablePinsOutKeys.find((key) => key === pinsIn.value) || "Default";

      return exec({
        execPinOut: pinToTrigger,
        pinsOut: {},
        meta: null,
      });
    },
  })
  .defineFunction("SwitchNumber", {
    pinsIn: { value: { type: CommonDataType.Number } },
    pinsOut: {},
    execPinsIn: { "": null },
    execPinsOut: { Default: null },
    addExecPinOut: ({ actions }) => {
      const pins = actions.getAllPins();
      const execPinsOut = pins.filter((p) => p.type === PinInstanceType.OutputExec);

      const namesSet = new Set(execPinsOut.map((p) => p.name));
      let newName = `Case 1`;
      let nameIndex = 1;

      while (namesSet.has(newName)) {
        newName = `Case ${nameIndex}`;
        nameIndex++;
      }

      actions.addExecPin(newName, PinInstanceType.OutputExec);
    },
    exec: ({ pinsIn, execPinsOut, exec }) => {
      const availablePinsOutKeys = Object.keys(execPinsOut);

      const pinToTrigger =
        availablePinsOutKeys.find((key) => Number(key) === pinsIn.value) || "Default";

      return exec({
        execPinOut: pinToTrigger,
        pinsOut: {},
        meta: null,
      });
    },
  })
  .defineFunction("DoN", {
    pinsIn: { n: { type: CommonDataType.Number } },
    execPinsIn: { "": null, Reset: null },
    pinsOut: { Counter: { type: CommonDataType.Number } },
    execPinsOut: { "": null },
    meta: { type: CommonDataType.Number },
    exec: async ({ pinsIn, triggeredExecPinKey, meta, exec }) => {
      if (triggeredExecPinKey === "Reset") {
        return exec({
          execPinOut: null,
          pinsOut: { Counter: 0 },
          meta: 0,
        });
      }

      if (meta === null || pinsIn.n === null) {
        return;
      }

      if (meta < pinsIn.n) {
        return exec({
          execPinOut: "",
          pinsOut: { Counter: meta + 1 },
          meta: meta + 1,
        });
      }
    },
  })
  .defineFunction("DoOnce", {
    pinsIn: {},
    execPinsIn: { "": null, Reset: null },
    pinsOut: {},
    execPinsOut: { "": null },
    meta: { type: CommonDataType.Boolean },
    exec: async ({ triggeredExecPinKey, meta, exec }) => {
      if (triggeredExecPinKey === "Reset") {
        return exec({
          execPinOut: null,
          pinsOut: {},
          meta: false,
        });
      }

      if (meta === null || meta === true) {
        return;
      }

      return exec({
        execPinOut: "",
        pinsOut: {},
        meta: true,
      });
    },
  })
  .defineFunction("FlipFlop", {
    pinsIn: {},
    pinsOut: {},
    execPinsIn: { "": null },
    execPinsOut: { Flip: null, Flop: null },
    meta: { type: CommonDataType.Boolean },
    exec: ({ meta, exec }) => {
      // Boolean meta defaults to false and records whether the previous branch was Flip.
      const isFlip = !meta;
      return exec({
        execPinOut: isFlip ? "Flip" : "Flop",
        pinsOut: {},
        meta: isFlip,
      });
    },
  })
  .defineFunction("Gate", {
    pinsIn: {},
    pinsOut: {},
    execPinsIn: { "": null, Open: null, Toggle: null, Close: null },
    execPinsOut: { "": null },
    meta: { type: CommonDataType.Boolean },
    exec: async ({ meta, exec, triggeredExecPinKey }) => {
      if (triggeredExecPinKey === "") {
        // Boolean meta defaults to false, so a new Gate starts closed.
        if (meta) {
          return exec({
            execPinOut: "",
            pinsOut: {},
            meta,
          });
        }
      }

      if (triggeredExecPinKey === "Open") {
        return exec({
          execPinOut: null,
          pinsOut: {},
          meta: true,
        });
      }

      if (triggeredExecPinKey === "Toggle") {
        return exec({
          execPinOut: null,
          pinsOut: {},
          meta: !meta,
        });
      }

      if (triggeredExecPinKey === "Close") {
        return exec({
          execPinOut: null,
          pinsOut: {},
          meta: false,
        });
      }
    },
  });

// node id выбран
// есть список outputExecPin'ов
flowControlExtension.createSchema();
