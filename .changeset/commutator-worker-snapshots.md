---
"@commutator/core": minor
---

Add strict graph-bound JSON Worker snapshots and independent nested data at restore,
trigger input, and extract boundaries. Reject legacy or invalid snapshots.

Serialize triggers per Worker with WORKER_BUSY, drain callbacks and nested exec
before settling, reject closed exec, and make failed Workers terminal. Restore the
last successful baseline in a fresh Worker to replay a failed or crashed trigger.

Add actual SIGKILL replay coverage, a test-only Flow/Agents idempotency and receipt
consumer, and bounded snapshot observations. Comparative performance acceptance
and non-macOS runtime checks remain external validation gates.

Reject explicitly undefined outputs/metadata and validate finite JSON event input
before callbacks while preserving aliases and key order within the run. Normalize
only optional library Field names in graph identity; keep user JSON strict and
reject custom Array prototypes consistently. Compute identity once per extract
without caching over live Schema. Exercise automatic unknown-outcome handling
when a provider response is lost and authoritative lookup cannot resolve it.
