# COM-0008 reproductions

These opt-in probes do not run in the unit suite. Use an external process guard;
run suites and benchmarks sequentially. Bun is required; the orchestration scripts
also require Python 3. The SIGKILL probe uses POSIX `select` and is not a Windows
acceptance test. None of these helpers implements production Flow or Agents.

## Paired benchmark

Prepare two installed checkouts, baseline `af9ce9bcded35b5ead9020215cf24f2f2ba7f51a`
and the candidate commit recorded in the report. Pass absolute checkout paths and
a new output directory; existing evidence directories are never overwritten.

```sh
COM0008_GUARD=/absolute/path/to/test-guard/run.mjs
node "$COM0008_GUARD" -- python3 tooling/com0008/run-paired.py \
  /absolute/path/to/baseline /absolute/path/to/candidate \
  /absolute/path/to/new-evidence --rounds 5
```

The runner creates SchemaSnapshots once using the baseline, then gives both
versions exactly those files. Every pair checks graph and final pin/meta hashes.
Array order and UUIDs stay fixed within the comparison. Seven timed samples follow
warmup; pair order alternates. Ordinary trigger workloads cover empty/numeric/
wide/nested payloads, event-only delivery, Pure Functions and unawaited exec.
Separate cases measure extract, restore and restore/trigger/extract checkpoints.
The candidate does more work at snapshot boundaries than the old shallow snapshot;
report that cost separately from ordinary traversal. No threshold grants acceptance.

Each child writes JSON plus a log, and `paired/commands.json` records commands,
exit codes and elapsed time. Preserve failing runs. `sources.json`, `counts.json`
and the shared `schemas/` make the input reproducible. Regenerating schemas changes
UUIDs; retain the generated directory when comparing further candidates.

The benchmark child also provides `memory` and `snapshot-memory` modes. These
perform forced GC between diagnostic epochs to inspect retained heap/Promise
counts; they are separate from timed throughput and do not prove a bound on RSS.
Set `COM0008_DATA_DIR` to the generated evidence directory:

```sh
COM0008_DATA_DIR=/absolute/path/to/new-evidence \
  node "$COM0008_GUARD" -- bun tooling/com0008/benchmark.ts \
  candidate snapshot-memory number-32 10000 /absolute/path/to/memory.json
```

## Process recovery

```sh
node "$COM0008_GUARD" -- python3 tooling/com0008/run-crash.py \
  /absolute/path/to/candidate /absolute/path/to/new-crash-evidence
```

A baseline has one committed Seed event. A pending command runs A, awaits B's
short fake agent start and executes A's tail. Five real SIGKILL barriers cover
before/after start, after B, before commit and after commit. A fresh process either
replays the entire pending trigger or reconciles the completed command receipt.
The control and all recovered paths must have identical final snapshots, one
fake agent effect and exactly one prior committed Seed. Duplicate delivery must
read the receipt without reexecuting the command. Every killed/continued child is
waited for. JSON files model consumer persistence only; no production store,
provider crash window, distributed lease or real agent is tested.

## New rejection behavior

```sh
node "$COM0008_GUARD" -- bun tooling/com0008/error-benchmark.ts \
  /absolute/path/to/candidate 5000 /absolute/path/to/errors.json
```

This candidate-only probe measures busy trigger/extract, failed trigger/extract
and invalid snapshot rejection, verifies error codes and checks that rejected busy
input cannot change the active command. The old Worker allowed different behavior;
there is no meaningful baseline percentage for these cases.
