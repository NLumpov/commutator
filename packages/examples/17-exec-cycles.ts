import { CommonDataType, Commutator } from "@commutator/core";

// One configuration inherited by every schema/worker from this instance.
const commutator = Commutator.initialize({ maxSteps: 20 })
  .defineEvent("start", { pinsOut: {}, execPinsOut: { next: null } })
  .defineFunction("Develop", {
    pinsIn: {},
    pinsOut: { attempt: { type: CommonDataType.Number } },
    execPinsIn: { enter: null },
    execPinsOut: { review: null },
    meta: { type: CommonDataType.Number },
    exec: ({ meta, exec }) => {
      const attempt = (meta ?? 0) + 1;
      console.log(`Develop attempt ${attempt}`);
      return exec({ execPinOut: "review", pinsOut: { attempt }, meta: attempt });
    },
  })
  .defineFunction("Review", {
    pinsIn: { attempt: { type: CommonDataType.Number } },
    pinsOut: {},
    execPinsIn: { enter: null },
    execPinsOut: { rework: null },
    exec: ({ pinsIn, exec }) => {
      const accepted = pinsIn.attempt !== null && pinsIn.attempt >= 3;
      console.log(accepted ? "Accepted" : "Needs rework");
      return exec({ execPinOut: accepted ? null : "rework", pinsOut: {}, meta: null });
    },
  });

const schema = commutator.createSchema();
const develop = schema.createFunction("Develop");
const review = schema.createFunction("Review");
schema.createEvent("start").wire("next", develop, "enter");
develop.wire("review", review, "enter").wire("attempt", review, "attempt");
review.wire("rework", develop, "enter");

// Real cyclic wires round-trip through SchemaSnapshot.
const worker = commutator.createSchema(schema.extract()).createWorker();
await worker.triggerEvent("start", {}); // Six Function admissions, one shared budget.
// WorkerSnapshot is cache-only; it does not resume a suspended run.
