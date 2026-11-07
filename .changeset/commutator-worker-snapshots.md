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

Build canonical graph containers once, strictly copying live values with a copier
scoped to the current call. Reuse validated snapshot entries and avoid temporary
cache tuple arrays. Keep all strict JSON, isolation, and live-mutation checks.

Replace positional initialization with one optional object containing dataTypes,
events, refs, pureFunctions, functions, and apis. Reject extra arguments and unknown
option keys. Fluent builders expose node properties only through instance; wire()
continues to connect builders or node UUIDs. Remove forwarding aliases and update
all repository consumers and examples to the single current API.
