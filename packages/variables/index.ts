import { CommonDataType, Commutator } from "@commutator/core";

export const createVariablesExtension = (
  get: (name: string) => Promise<unknown>,
  set: (name: string, value: unknown) => Promise<void>,
) => {
  const commutator = Commutator.initialize();
  return commutator
    .defineApi("Variables", {
      get,
      set,
    })
    .defineRef("GetVariable", {
      config: {
        type: CommonDataType.Object,
        properties: {
          name: { type: CommonDataType.String },
          type: { type: CommonDataType.String },
        },
      },
      pinsOut: {
        Value: { type: CommonDataType.Any },
      },
      onConfigChange: ({ config, actions }) => {
        const valuePin = actions.getPin("Value");

        // Если в коммутаторе есть DataType соответствующий
        if (config.type && commutator.validator.hasDataType(config.type) && valuePin) {
          valuePin.pinType = config.type;
        }
      },
      resolveRef: async ({ config, api }) => {
        if (!config.name) {
          return { Value: null };
        }

        const value = await api.Variables.get(config.name);

        if (
          config.type &&
          commutator.validator.hasDataType(config.type) &&
          commutator.validator.validateFieldValue({ type: config.type }, value)
        ) {
          return { Value: null };
        }

        return { Value: null };
      },
    })
    .defineFunction("SetVariable", {
      config: {
        type: CommonDataType.Object,
        properties: {
          name: { type: CommonDataType.String },
          type: { type: CommonDataType.String },
        },
      },
      pinsIn: {
        Value: { type: CommonDataType.Any },
      },
      pinsOut: {},
      canAddPinIn: false,
      canAddPinOut: false,
      execPinsIn: { "": {} },
      execPinsOut: { "": {} },
      canAddExecPinIn: false,
      canAddExecPinOut: false,
      onConfigChange: ({ config, actions }) => {
        const valuePin = actions.getPin("Value");

        // Если в коммутаторе есть DataType соответствующий
        if (config.type && commutator.validator.hasDataType(config.type) && valuePin) {
          valuePin.pinType = config.type;
        }
      },
      exec: async ({ pinsIn, config, exec }) => {
        if (!config.name) {
          await exec({
            execPinOut: "",
            pinsOut: {},
            meta: null,
          });
          return;
        }

        const value = pinsIn.Value;

        if (
          config.type &&
          commutator.validator.hasDataType(config.type) &&
          !commutator.validator.validateFieldValue({ type: config.type }, value)
        ) {
          await exec({
            execPinOut: "",
            pinsOut: {},
            meta: null,
          });
          return;
        }

        await set(config.name, value);

        await exec({
          execPinOut: "",
          pinsOut: {},
          meta: null,
        });
      },
    });
};
