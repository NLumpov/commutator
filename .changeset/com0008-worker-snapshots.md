---
"@commutator/core": minor
---

Make Worker snapshots independent finite JSON boundaries with strict complete
validation and an order-sensitive canonical graph fingerprint. Preserve immediate
exec/await traversal while rejecting overlapping triggers, active extraction and
late exec calls; failed Workers drain children and require recreation from a saved
baseline. Trigger input and restored snapshots no longer alias caller objects.

Consumers using createWorker(snapshot), WorkerSnapshot literals, concurrent calls
or failed-instance reuse must adopt the fingerprint-bearing format and save one
baseline per complete short trigger. Flow/Agents integrations own stable operation
IDs, reconciliation, finite attempts and atomic snapshot/command receipts. No
legacy snapshot adapter, durable service runtime, Join or publication is included.
