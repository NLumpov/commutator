export class CommutatorError extends Error {}

export class CommutatorExecutionError extends CommutatorError {
  constructor(public readonly code: "INVALID_MAX_STEPS" | "MAX_STEPS_REQUIRED" | "STEP_LIMIT") {
    super(code);
    this.name = "CommutatorExecutionError";
  }
}
