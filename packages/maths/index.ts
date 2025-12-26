import { CommonDataType, Commutator } from "@commutator/core";

export const mathsExtension = Commutator.initialize()
  .definePureFunction("Add", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.A || 0) + (pinsIn.B || 0),
    }),
  })
  .definePureFunction("Subtract", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.A || 0) - (pinsIn.B || 0),
    }),
  })
  .definePureFunction("Multiply", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.A || 0) * (pinsIn.B || 0),
    }),
  })
  .definePureFunction("Divide", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const b = pinsIn.B || 0;

      if (b === 0) {
        return {
          Result: 0,
        };
      }

      return { Result: a / b };
    },
  })
  .definePureFunction("Sin", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.sin(pinsIn.A || 0),
    }),
  })
  .definePureFunction("Cos", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.cos(pinsIn.A || 0),
    }),
  })
  .definePureFunction("Tan", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.tan(pinsIn.A || 0),
    }),
  })
  .definePureFunction("Cot", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const tanValue = Math.tan(a);
      
      if (tanValue === 0) {
        return { Result: 0 };
      }
      
      return { Result: 1 / tanValue };
    },
  })
  .definePureFunction("Asin", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.asin(pinsIn.A || 0),
    }),
  })
  .definePureFunction("Acos", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.acos(pinsIn.A || 0),
    }),
  })
  .definePureFunction("Atan", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.atan(pinsIn.A || 0),
    }),
  })
  .definePureFunction("Acot", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      
      if (a === 0) {
        return { Result: Math.PI / 2 };
      }
      
      return { Result: Math.atan(1 / a) };
    },
  })
  .definePureFunction("Sinh", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const result = Math.sinh(a);
      
      if (Number.isNaN(result) || result === Infinity || result === -Infinity) {
        return { Result: 0 };
      }
      
      return { Result: result };
    },
  })
  .definePureFunction("Cosh", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const result = Math.cosh(a);
      
      if (Number.isNaN(result) || result === Infinity || result === -Infinity) {
        return { Result: 0 };
      }
      
      return { Result: result };
    },
  })
  .definePureFunction("Tanh", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.tanh(pinsIn.A || 0),
    }),
  })
  .definePureFunction("Asinh", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const result = Math.asinh(a);
      
      if (Number.isNaN(result)) {
        return { Result: 0 };
      }
      
      return { Result: result };
    },
  })
  .definePureFunction("Acosh", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      
      if (a < 1) {
        return { Result: 0 };
      }
      
      const result = Math.acosh(a);
      
      if (Number.isNaN(result)) {
        return { Result: 0 };
      }
      
      return { Result: result };
    },
  })
  .definePureFunction("Atanh", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      
      if (a <= -1 || a >= 1) {
        return { Result: 0 };
      }
      
      const result = Math.atanh(a);
      
      if (Number.isNaN(result)) {
        return { Result: 0 };
      }
      
      return { Result: result };
    },
  })
  .definePureFunction("Power", {
    pinsIn: {
      Base: { type: CommonDataType.Number },
      Exponent: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const base = pinsIn.Base || 0;
      const exponent = pinsIn.Exponent || 0;
      const result = Math.pow(base, exponent);
      
      if (Number.isNaN(result) || result === Infinity || result === -Infinity) {
        return { Result: 0 };
      }
      
      return { Result: result };
    },
  })
  .definePureFunction("Sqrt", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      
      if (a < 0) {
        return { Result: 0 };
      }
      
      return { Result: Math.sqrt(a) };
    },
  })
  .definePureFunction("Pi", {
    pinsIn: {},
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async () => ({
      Result: Math.PI,
    }),
  })
  .definePureFunction("E", {
    pinsIn: {},
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async () => ({
      Result: Math.E,
    }),
  })
  .definePureFunction("Log", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      
      if (a <= 0) {
        return { Result: 0 };
      }
      
      return { Result: Math.log(a) };
    },
  })
  .definePureFunction("Integral", {
    pinsIn: {
      Start: { type: CommonDataType.Number },
      End: { type: CommonDataType.Number },
      Steps: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const start = pinsIn.Start ?? 0;
      const end = pinsIn.End ?? 1;
      const steps = Math.max(1, Math.floor(pinsIn.Steps ?? 100));
      
      if (start === end) {
        return { Result: 0 };
      }
      
      const stepSize = (end - start) / steps;
      let sum = 0;
      
      for (let i = 0; i < steps; i++) {
        const x = start + i * stepSize;
        const y = x * x;
        sum += y * stepSize;
      }
      
      return { Result: sum };
    },
  })
  .definePureFunction("RandomNumber", {
    pinsIn: {
      Min: { type: CommonDataType.Number },
      Max: { type: CommonDataType.Number },
      AllowFloat: { type: CommonDataType.Boolean },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const min = pinsIn.Min ?? 0;
      const max = pinsIn.Max ?? 1;
      const allowFloat = pinsIn.AllowFloat ?? false;

      const actualMin = Math.min(min, max);
      const actualMax = Math.max(min, max);

      if (allowFloat) {
        const result = Math.random() * (actualMax - actualMin) + actualMin;
        return { Result: result };
      } else {
        const result =
          Math.floor(Math.random() * (actualMax - actualMin + 1)) + actualMin;
        return { Result: result };
      }
    },
  })
  .definePureFunction("Modulo", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const b = pinsIn.B || 0;

      if (b === 0) {
        return { Result: 0 };
      }

      return { Result: a % b };
    },
  })
  .definePureFunction("Round", {
    pinsIn: {
      Value: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.round(pinsIn.Value || 0),
    }),
  })
  .definePureFunction("Floor", {
    pinsIn: {
      Value: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.floor(pinsIn.Value || 0),
    }),
  })
  .definePureFunction("Ceil", {
    pinsIn: {
      Value: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.ceil(pinsIn.Value || 0),
    }),
  })
  .definePureFunction("Trunc", {
    pinsIn: {
      Value: { type: CommonDataType.Number },
      Decimals: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || 0;
      const decimals = Math.max(0, Math.floor(pinsIn.Decimals ?? 0));

      const multiplier = Math.pow(10, decimals);

      return { Result: Math.trunc(value * multiplier) / multiplier };
    },
  })
  .definePureFunction("Abs", {
    pinsIn: {
      Value: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.abs(pinsIn.Value || 0),
    }),
  })
  .definePureFunction("Max", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.max(pinsIn.A || 0, pinsIn.B || 0),
    }),
  })
  .definePureFunction("Min", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.min(pinsIn.A || 0, pinsIn.B || 0),
    }),
  })
  .definePureFunction("Sign", {
    pinsIn: {
      Value: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.sign(pinsIn.Value || 0),
    }),
  })
  .definePureFunction("Log10", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      
      if (a <= 0) {
        return { Result: 0 };
      }
      
      return { Result: Math.log10(a) };
    },
  })
  .definePureFunction("Log2", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      
      if (a <= 0) {
        return { Result: 0 };
      }
      
      return { Result: Math.log2(a) };
    },
  })
  .definePureFunction("Exp", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const result = Math.exp(a);
      
      if (Number.isNaN(result) || result === Infinity || result === -Infinity) {
        return { Result: 0 };
      }
      
      return { Result: result };
    },
  })
  .definePureFunction("Cbrt", {
    pinsIn: {
      A: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.cbrt(pinsIn.A || 0),
    }),
  })
  .definePureFunction("Atan2", {
    pinsIn: {
      Y: { type: CommonDataType.Number },
      X: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: Math.atan2(pinsIn.Y || 0, pinsIn.X || 0),
    }),
  })
  .definePureFunction("Degrees", {
    pinsIn: {
      Radians: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: ((pinsIn.Radians || 0) * 180) / Math.PI,
    }),
  })
  .definePureFunction("Radians", {
    pinsIn: {
      Degrees: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => ({
      Result: ((pinsIn.Degrees || 0) * Math.PI) / 180,
    }),
  })
  .definePureFunction("Hypot", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const b = pinsIn.B || 0;
      const result = Math.hypot(a, b);
      
      if (Number.isNaN(result) || result === Infinity || result === -Infinity) {
        return { Result: 0 };
      }
      
      return { Result: result };
    },
  })
  .definePureFunction("Clamp", {
    pinsIn: {
      Value: { type: CommonDataType.Number },
      Min: { type: CommonDataType.Number },
      Max: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || 0;
      const min = pinsIn.Min ?? -Infinity;
      const max = pinsIn.Max ?? Infinity;
      
      const actualMin = Math.min(min, max);
      const actualMax = Math.max(min, max);
      
      return { Result: Math.max(actualMin, Math.min(actualMax, value)) };
    },
  })
  .definePureFunction("Lerp", {
    pinsIn: {
      A: { type: CommonDataType.Number },
      B: { type: CommonDataType.Number },
      T: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    canAddPinIn: false,
    canAddPinOut: false,
    exec: async ({ pinsIn }) => {
      const a = pinsIn.A || 0;
      const b = pinsIn.B || 0;
      const t = Math.max(0, Math.min(1, pinsIn.T ?? 0));
      
      return { Result: a + (b - a) * t };
    },
  });
