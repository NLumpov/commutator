import { CommonDataType, Commutator } from "@commutator/core";

export const stringExtension = Commutator.initialize()
  .definePureFunction("Concat", {
    pinsIn: {
      A: { type: CommonDataType.String },
      B: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => ({
      Result: `${pinsIn.A || ""}${pinsIn.B || ""}`,
    }),
  })
  .definePureFunction("Length", {
    pinsIn: {
      Value: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    exec: async ({ pinsIn }) => ({
      Result: pinsIn.Value?.length || 0,
    }),
  })
  .definePureFunction("Substring", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Start: { type: CommonDataType.Number },
      End: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const start = pinsIn.Start ?? 0;
      const end = pinsIn.End ?? value.length;
      return {
        Result: value.substring(start, end),
      };
    },
  })
  .definePureFunction("Split", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Separator: { type: CommonDataType.String },
      Limit: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Array, itemType: { type: CommonDataType.String } } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const separator = pinsIn.Separator || "";
      const limit = pinsIn.Limit;
      return {
        Result:
          limit !== undefined && limit !== null
            ? value.split(separator, limit)
            : value.split(separator),
      };
    },
  })
  .definePureFunction("Join", {
    pinsIn: {
      Value: { type: CommonDataType.Array, itemType: { type: CommonDataType.String } },
      Separator: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || [];
      const separator = pinsIn.Separator || "";
      return {
        Result: value.join(separator),
      };
    },
  })
  .definePureFunction("Slice", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Start: { type: CommonDataType.Number },
      End: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const start = pinsIn.Start ?? 0;
      const end = pinsIn.End ?? value.length;
      return {
        Result: value.slice(start, end),
      };
    },
  })
  .definePureFunction("ToUpperCase", {
    pinsIn: {
      Value: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.Value || "").toUpperCase(),
    }),
  })
  .definePureFunction("ToLowerCase", {
    pinsIn: {
      Value: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.Value || "").toLowerCase(),
    }),
  })
  .definePureFunction("Trim", {
    pinsIn: {
      Value: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.Value || "").trim(),
    }),
  })
  .definePureFunction("TrimStart", {
    pinsIn: {
      Value: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.Value || "").trimStart(),
    }),
  })
  .definePureFunction("TrimEnd", {
    pinsIn: {
      Value: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.Value || "").trimEnd(),
    }),
  })
  .definePureFunction("Replace", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Search: { type: CommonDataType.String },
      Replace: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const search = pinsIn.Search || "";
      const replace = pinsIn.Replace || "";
      return {
        Result: value.replace(search, replace),
      };
    },
  })
  .definePureFunction("ReplaceAll", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Search: { type: CommonDataType.String },
      Replace: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const search = pinsIn.Search || "";
      const replace = pinsIn.Replace || "";
      return {
        Result: value.replaceAll(search, replace),
      };
    },
  })
  .definePureFunction("IndexOf", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Search: { type: CommonDataType.String },
      FromIndex: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const search = pinsIn.Search || "";
      const fromIndex = pinsIn.FromIndex;
      return {
        Result:
          fromIndex !== undefined && fromIndex !== null
            ? value.indexOf(search, fromIndex)
            : value.indexOf(search),
      };
    },
  })
  .definePureFunction("LastIndexOf", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Search: { type: CommonDataType.String },
      FromIndex: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const search = pinsIn.Search || "";
      const fromIndex = pinsIn.FromIndex;
      return {
        Result:
          fromIndex !== undefined && fromIndex !== null
            ? value.lastIndexOf(search, fromIndex)
            : value.lastIndexOf(search),
      };
    },
  })
  .definePureFunction("StartsWith", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Search: { type: CommonDataType.String },
      Position: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const search = pinsIn.Search || "";
      const position = pinsIn.Position;
      return {
        Result:
          position !== undefined && position !== null
            ? value.startsWith(search, position)
            : value.startsWith(search),
      };
    },
  })
  .definePureFunction("EndsWith", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Search: { type: CommonDataType.String },
      Length: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const search = pinsIn.Search || "";
      const length = pinsIn.Length;
      return {
        Result:
          length !== undefined && length !== null
            ? value.endsWith(search, length)
            : value.endsWith(search),
      };
    },
  })
  .definePureFunction("Contains", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Search: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.Boolean } },
    exec: async ({ pinsIn }) => ({
      Result: (pinsIn.Value || "").includes(pinsIn.Search || ""),
    }),
  })
  .definePureFunction("PadStart", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Length: { type: CommonDataType.Number },
      PadString: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const length = pinsIn.Length ?? 0;
      const padString = pinsIn.PadString || " ";
      return {
        Result: value.padStart(length, padString),
      };
    },
  })
  .definePureFunction("PadEnd", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Length: { type: CommonDataType.Number },
      PadString: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const length = pinsIn.Length ?? 0;
      const padString = pinsIn.PadString || " ";
      return {
        Result: value.padEnd(length, padString),
      };
    },
  })
  .definePureFunction("CharAt", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Index: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const index = pinsIn.Index ?? 0;
      return {
        Result: value.charAt(index),
      };
    },
  })
  .definePureFunction("CharCodeAt", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Index: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const index = pinsIn.Index ?? 0;
      return {
        Result: value.charCodeAt(index),
      };
    },
  })
  .definePureFunction("Repeat", {
    pinsIn: {
      Value: { type: CommonDataType.String },
      Count: { type: CommonDataType.Number },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const count = pinsIn.Count ?? 0;
      return {
        Result: value.repeat(count),
      };
    },
  })
  .definePureFunction("Reverse", {
    pinsIn: {
      Value: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      return {
        Result: value.split("").reverse().join(""),
      };
    },
  })
  .definePureFunction("ToNumber", {
    pinsIn: {
      Value: { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.Number } },
    exec: async ({ pinsIn }) => {
      const value = pinsIn.Value || "";
      const num = Number(value);
      return {
        Result: Number.isNaN(num) ? 0 : num,
      };
    },
  })
  .definePureFunction("ToString", {
    pinsIn: {
      Value: { type: CommonDataType.Any },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    exec: async ({ pinsIn }) => ({
      Result: String(pinsIn.Value ?? ""),
    }),
  })
  .definePureFunction("FormatString", {
    pinsIn: {
      "": { type: CommonDataType.String },
    },
    pinsOut: { Result: { type: CommonDataType.String } },
    addPinIn: () => {},
    exec: async ({ pinsIn }) => {
      const template = String(pinsIn[""] ?? "");
      let result = template;

      for (const [key, value] of Object.entries(pinsIn)) {
        if (key === "") {
          continue;
        }
        result = result.replaceAll(`{${key}}`, String(value ?? ""));
      }

      return {
        Result: result,
      };
    },
  });
