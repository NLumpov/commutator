export class CommutatorError extends Error {}

export class CommutatorExecutionError extends CommutatorError {
  constructor(
    public readonly code:
      | "INVALID_MAX_STEPS"
      | "MAX_STEPS_REQUIRED"
      | "STEP_LIMIT"
      | "WORKER_BUSY"
      | "WORKER_FAILED"
      | "EXEC_CONTEXT_CLOSED",
  ) {
    super(code);
    this.name = "CommutatorExecutionError";
  }
}
