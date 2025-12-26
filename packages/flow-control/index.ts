import { CommonDataType, Commutator } from "@commutator/core";

export const flowControlExtension = Commutator.initialize()
  .defineFunction("Branch", {
    pinsIn: { condition: { type: CommonDataType.Boolean } },
    pinsOut: {},
    execPinsIn: { "": {} },
    execPinsOut: { A: {}, B: {} },
    canAddPinIn: false,
    canAddPinOut: false,
    canAddExecPinIn: false,
    canAddExecPinOut: false,
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
    execPinsIn: { "": {} },
    execPinsOut: { Default: {} },
    canAddPinIn: false,
    canAddPinOut: false,
    canAddExecPinIn: false,
    canAddExecPinOut: true,
    exec: ({ pinsIn, execPinsOut, exec }) => {
      const availablePinsOutKeys = Object.keys(execPinsOut);

      const pinToTrigger =
        availablePinsOutKeys.find((key) => key === pinsIn.value) || "Default";

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
    execPinsIn: { "": {} },
    execPinsOut: { Default: {} },
    canAddPinIn: false,
    canAddPinOut: false,
    canAddExecPinIn: false,
    canAddExecPinOut: true,
    exec: ({ pinsIn, execPinsOut, exec }) => {
      const availablePinsOutKeys = Object.keys(execPinsOut);

      const pinToTrigger =
        availablePinsOutKeys.find((key) => Number(key) === pinsIn.value) ||
        "Default";

      return exec({
        execPinOut: pinToTrigger,
        pinsOut: {},
        meta: null,
      });
    },
  })
  .defineFunction("DoN", {
    pinsIn: { n: { type: CommonDataType.Number } },
    execPinsIn: { "": {}, Reset: {} },
    pinsOut: { Counter: { type: CommonDataType.Number } },
    execPinsOut: { "": {} },
    canAddPinIn: false,
    canAddPinOut: false,
    canAddExecPinIn: false,
    canAddExecPinOut: false,
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
          execPinOut: "Counter",
          pinsOut: { Counter: meta + 1 },
          meta: meta + 1,
        });
      }
    },
  })
  .defineFunction("DoOnce", {
    pinsIn: {},
    execPinsIn: { "": {}, Reset: {} },
    pinsOut: {},
    execPinsOut: { "": {} },
    canAddPinIn: false,
    canAddPinOut: false,
    canAddExecPinIn: false,
    canAddExecPinOut: false,
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
    execPinsIn: { "": {} },
    execPinsOut: { Flip: {}, Flop: {} },
    canAddPinIn: false,
    canAddPinOut: false,
    canAddExecPinIn: false,
    canAddExecPinOut: false,
    meta: { type: CommonDataType.Boolean },
    exec: ({ meta, exec }) => {
      const isFlip = meta || true;
      return exec({
        execPinOut: isFlip ? "Flip" : "Flop",
        pinsOut: {},
        meta: !isFlip,
      });
    },
  })
  .defineFunction("Gate", {
    pinsIn: {},
    pinsOut: {},
    execPinsIn: { "": {}, Open: {}, Toggle: {}, Close: {} },
    execPinsOut: { "": {} },
    canAddPinIn: false,
    canAddPinOut: false,
    canAddExecPinIn: false,
    canAddExecPinOut: false,
    meta: { type: CommonDataType.Boolean },
    exec: async ({ meta, exec, triggeredExecPinKey }) => {
      if (triggeredExecPinKey === "") {
        const isOpen = meta || true;

        if (isOpen) {
          return exec({
            execPinOut: null,
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
