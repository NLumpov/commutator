import { CommonDataType, Commutator } from "@commutator/core";

// Система управления состоянием игрового персонажа
const commutator = Commutator.initialize()
  .defineDataType("CharacterState", {
    type: CommonDataType.StringEnum,
    values: ["Idle", "Walking", "Running", "Jumping", "Attacking", "Dead"],
  })
  .defineEvent("KeyPressed", {
    pinsOut: {
      key: { type: CommonDataType.String },
    },
    execPinsOut: { next: {} },
  })
  .defineEvent("DamageReceived", {
    pinsOut: {
      damage: { type: CommonDataType.Number },
    },
    execPinsOut: { next: {} },
  })
  .defineEvent("ItemCollected", {
    pinsOut: {
      itemType: { type: CommonDataType.String },
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("StateMachine", {
    pinsIn: {
      currentState: { type: CommonDataType.String },
      eventKey: { type: CommonDataType.String },
      eventDamage: { type: CommonDataType.Number },
      eventItem: { type: CommonDataType.String },
    },
    pinsOut: {
      newState: { type: CommonDataType.String },
    },
    execPinsIn: { keyPressed: {}, damageReceived: {}, itemCollected: {} },
    execPinsOut: { stateChanged: {} },
    meta: { type: CommonDataType.String }, // Текущее состояние
    exec: async ({ pinsIn, exec, triggeredExecPinKey, meta }) => {
      const currentState = meta ?? "Idle";
      let newState = currentState;

      if (triggeredExecPinKey === "keyPressed") {
        const key = pinsIn.eventKey ?? "";
        if (key === "W" && currentState === "Idle") {
          newState = "Walking";
        } else if (key === "Shift+W" && currentState === "Walking") {
          newState = "Running";
        } else if (key === "Space" && currentState !== "Jumping") {
          newState = "Jumping";
        } else if (key === "Mouse1" && currentState !== "Attacking") {
          newState = "Attacking";
        }
      } else if (triggeredExecPinKey === "damageReceived") {
        // Урон может прервать анимацию атаки
        if (currentState === "Attacking") {
          newState = "Idle";
        }
      } else if (triggeredExecPinKey === "itemCollected") {
        // Сбор предмета не меняет состояние, но может быть обработан отдельно
      }

      if (newState !== currentState) {
        await exec({
          execPinOut: "stateChanged",
          pinsOut: {
            newState,
          },
          meta: newState,
        });
      }
    },
  })
  .definePureFunction("HealthCheck", {
    pinsIn: {
      currentHealth: { type: CommonDataType.Number },
      damage: { type: CommonDataType.Number },
    },
    pinsOut: {
      newHealth: { type: CommonDataType.Number },
      isDead: { type: CommonDataType.Boolean },
    },
    exec: async ({ pinsIn }) => {
      const newHealth = Math.max(0, (pinsIn.currentHealth ?? 100) - (pinsIn.damage ?? 0));
      const isDead = newHealth <= 0;
      return { newHealth, isDead };
    },
  })
  .defineFunction("ApplyDamage", {
    pinsIn: {
      currentHealth: { type: CommonDataType.Number },
      damage: { type: CommonDataType.Number },
    },
    pinsOut: {
      newHealth: { type: CommonDataType.Number },
    },
    execPinsIn: { start: {} },
    execPinsOut: { alive: {}, dead: {} },
    meta: { type: CommonDataType.Number }, // Текущее здоровье
    exec: async ({ pinsIn, exec, meta }) => {
      const currentHealth = meta ?? 100;
      const newHealth = Math.max(0, currentHealth - (pinsIn.damage ?? 0));
      const isDead = newHealth <= 0;

      if (isDead) {
        await exec({
          execPinOut: "dead",
          pinsOut: {
            newHealth: 0,
          },
          meta: 0,
        });
      } else {
        await exec({
          execPinOut: "alive",
          pinsOut: {
            newHealth,
          },
          meta: newHealth,
        });
      }
    },
  })
  .defineFunction("UpdateAnimation", {
    pinsIn: {
      state: { type: CommonDataType.String },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(`[Animation] Playing ${pinsIn.state} animation`);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const keyPressed = schema.createEvent("KeyPressed");
const damageReceived = schema.createEvent("DamageReceived");
const itemCollected = schema.createEvent("ItemCollected");
const stateMachine = schema.createFunction("StateMachine");
const healthCheck = schema.createPureFunction("HealthCheck");
const applyDamage = schema.createFunction("ApplyDamage");
const updateAnimation = schema.createFunction("UpdateAnimation");

// Подключаем события к машине состояний
schema.wire(keyPressed, "key", stateMachine, "eventKey");
schema.wire(keyPressed, "next", stateMachine, "keyPressed");

schema.wire(damageReceived, "damage", stateMachine, "eventDamage");
schema.wire(damageReceived, "next", stateMachine, "damageReceived");
schema.wire(damageReceived, "damage", applyDamage, "damage");

// Обработка урона
schema.wire(applyDamage, "newHealth", stateMachine, "currentState"); // Нужно преобразовать health в state
schema.wire(applyDamage, "dead", stateMachine, "damageReceived"); // Если умер, меняем состояние

// Обновление анимации при изменении состояния
schema.wire(stateMachine, "newState", updateAnimation, "state");
schema.wire(stateMachine, "stateChanged", updateAnimation, "start");

console.log("Game Character State Machine created!");
