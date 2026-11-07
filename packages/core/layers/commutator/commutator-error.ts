export class CommutatorError extends Error {}

export class CommutatorExecutionError extends CommutatorError {
  constructor(
    public readonly code:
      | "INVALID_MAX_STEPS"
      | "MAX_STEPS_REQUIRED"
      | "STEP_LIMIT"
      | "WORKER_BUSY"
      | "WORKER_FAILED"
      | "EXEC_CLOSED"
      | "INVALID_JSON"
      | "INVALID_SNAPSHOT"
      | "SCHEMA_MISMATCH",
  ) {
    super(code);
    this.name = "CommutatorExecutionError";
  }
}
