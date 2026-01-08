import { CommonDataType, Commutator } from "@commutator/core";

export const createVariablesExtension = (
  get: (name: string) => Promise<unknown>,
  set: (name: string, value: unknown) => Promise<void>,
) => {
  const commutator = Commutator.initialize();

  return commutator
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

        // Если в коммутаторе есть такой DataType, то устанавливаем тип пина
        if (config.type && commutator.validator.hasDataType(config.type) && valuePin) {
          valuePin.pinType = config.type;
        }
        // Если типа не нашлось то ставим Any по умолчанию
        else if (valuePin) {
          valuePin.pinType = CommonDataType.Any;
        }
      },
      resolveRef: async ({ config }) => {
        if (!config.name) {
          return { Value: null };
        }

        try {
          const value = await get(config.name);

          // Если значение из переменной соответствует указанному типу, то возвращаем его
          if (
            config.type &&
            commutator.validator.hasDataType(config.type) &&
            commutator.validator.validateFieldValue({ type: config.type }, value)
          ) {
            return { Value: value };
          }

          // Иначе просто возвращаем null, как будто переменная не объявлена
          return { Value: null };
        } catch {
          // Если случилась ошибка при получении значения, то возвращаем null, как будто переменная не объявлена
          return { Value: null };
        }
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

        try {
          await set(config.name, value);
        } catch {
          await exec({
            execPinOut: "",
            pinsOut: {},
            meta: null,
          });
        }

        await exec({
          execPinOut: "",
          pinsOut: {},
          meta: null,
        });
      },
    });
};
