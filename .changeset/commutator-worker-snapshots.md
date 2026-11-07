---
"@commutator/core": minor
---

Validate JSON Worker snapshots and detach nested data at restore, trigger input,
and extract boundaries. Snapshots contain only pinCache and metaCache. The caller
must discard snapshots and existing Workers when the graph or definitions change.

Serialize triggers per Worker with WORKER_BUSY, drain callbacks and nested exec
before settling, reject closed exec, and make failed Workers terminal. Restore the
last successful baseline in a fresh Worker to replay a failed or crashed trigger.

Add actual SIGKILL replay coverage, a test-only Flow/Agents idempotency and receipt
consumer, and bounded snapshot observations. Comparative performance acceptance
and non-macOS runtime checks remain external validation gates.

Reject explicitly undefined outputs/metadata and validate finite JSON event input
before callbacks while preserving aliases and key order within the run. Keep user
JSON strict and reject custom Array prototypes consistently. Exercise automatic unknown-outcome handling
when a provider response is lost and authoritative lookup cannot resolve it.

Reuse validated snapshot entries and avoid temporary cache tuple arrays. Validate
cache membership and value types without serializing or comparing the graph.

Replace positional initialization with one optional object containing dataTypes,
events, refs, pureFunctions, functions, and apis. Reject extra arguments and unknown
option keys. Fluent builders expose node properties only through instance; wire()
continues to connect builders or node UUIDs. Remove forwarding aliases and update
all repository consumers and examples to the single current API.
