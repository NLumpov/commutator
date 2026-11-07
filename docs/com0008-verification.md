# COM-0008 verification

Scope: Commutator library, tests and documentation. No production Flow/Agents,
storage, retries, Join, merge or package publication. Baseline is
`af9ce9bcded35b5ead9020215cf24f2f2ba7f51a`; production candidate is
`94b9401cfa9233224234168f54c0f4b3428d7904`. Later documentation/test commits
do not change the benchmarked production sources.

## Runtime verification

| Check | Observed result |
| --- | --- |
| Guarded full suite and coverage | 339 PASS, 0 FAIL, 4068 assertions; process/guard exit 0 |
| TypeScript 5.9.3 / Biome / browser-target bundle | Exit 0 for each |
| Commit hooks | Biome and local TypeScript ran normally; exit 0 |
| Worker coverage | 29/29 functions; 508/508 lines |
| JSON helper coverage | 9/9 functions; 108/108 lines |
| Branch / statement coverage | NOT_REPORTED by Bun LCOV |
| Existing flow-control coverage gap | 33.33% functions / 61.80% lines; unrelated to this change |

The release suite took 2.08 seconds. Its guard record is
`1794049138412-24076.json` (168.4 MiB observed peak; 2.29 seconds including monitoring). Coverage does not establish an all-metric/all-file 80% gate:
missing metrics and the existing flow-control gap remain explicit. The browser
bundle resolves the portable hashing/serialization dependencies without Node
runtime imports in the library.

The original unpinned `bunx tsc` resolved TypeScript 7 and exited 1 on removed
`baseUrl` / `downlevelIteration` options before checking source. TypeScript 5.9.3
is now pinned and the hook invokes local `tsc`. This fixes reproducibility; it is
not a migration of all code to TypeScript 7.

The first targeted implementation diagnostic exited 1 (82 PASS / 8 FAIL): old
assertions extracted/reused failed Workers, overlapped one Worker or accepted
undefined command input. Changed-contract assertions were updated; immediate
traversal, unawaited child settlement and await/tail traces stayed covered.
Its guard record `1794047527910-13158.json` and task transcript remain historical
failure evidence. Later implementation runs are recorded separately.

## Paired benchmark method

macOS 26.3 arm64, Apple M4 Pro, 24 GiB RAM; Bun 1.4.2, Node 22.18.0.
Five alternating baseline/candidate pairs, seven timed samples after warmup in
each child; reported values are the median of the five child medians. Fixed
SchemaSnapshots were identical between versions; graph and pin/meta hashes matched
in every pair. All 160 sequential children and the external guard exited 0.
The guard observed 99.7 MiB peak for the owned process group.

The fingerprint cache was warmed by setup/warmup: these are steady-state snapshot
costs, not cold first extraction/hash costs. Live graph JSON is still validated
and serialized at every boundary, including nested direct edits. Timed throughput
does not force GC. Reproduction commands are in [the probe guide](../tooling/com0008/README.md);
[machine-readable results](com0008-benchmark-results.json) retain pair ranges,
snapshot byte counts and sampled child RSS. Windows/Linux runtime are NOT_RUN.

### Ordinary trigger

| Case | Baseline us | Candidate us | Change | Paired range |
| --- | ---: | ---: | ---: | ---: |
| empty-32 | 11.83 | 12.15 | +2.6% | +2.4% to +6.5% |
| number-32 | 16.76 | 17.14 | +2.3% | +2.2% to +3.2% |
| wide-32x8 | 46.37 | 47.93 | +3.4% | +1.1% to +5.5% |
| nested-128x8 | 13.96 | 20.29 | +45.3% | +40.0% to +48.3% |
| event-32 | 2.35 | 3.32 | +40.9% | +39.1% to +43.0% |
| pure-16 | 3.82 | 4.05 | +5.9% | +5.0% to +6.9% |
| unawaited-16 | 5.69 | 5.95 | +4.4% | +2.9% to +5.5% |

The input boundary now validates and detaches caller JSON. Event-only and nested
payload cases show that cost directly; the regressions above are real. There is
no cloning on each Function visit. Numeric/wide execution remains within the
measured +2.3%/+3.4% medians on this machine; this is not a platform-wide budget.

### Snapshot boundaries

| Case | Operation | Baseline us | Candidate us | Change |
| --- | --- | ---: | ---: | ---: |
| number-32 | extract | 1.51 | 110.12 | +7175.2% |
| number-32 | restore | 1.78 | 110.53 | +6105.3% |
| number-32 | checkpoint | 20.65 | 240.43 | +1064.4% |
| nested-128x8 | extract | 0.98 | 95.02 | +9597.7% |
| nested-128x8 | restore | 9.63 | 97.28 | +910.4% |
| nested-128x8 | checkpoint | 27.10 | 220.54 | +713.9% |
| wide-32x8 | extract | 4.03 | 460.52 | +11340.4% |
| wide-32x8 | restore | 10.16 | 464.14 | +4467.5% |
| wide-32x8 | checkpoint | 60.21 | 996.46 | +1555.0% |

`checkpoint` is restore -> trigger -> extract, not a production durable commit.
The old snapshot was shallow, aliased caller values, skipped invalid entries and
had no graph identity. The new operations perform independent JSON copying, strict
whole-snapshot/cache validation and a graph fingerprint. Those guarantees are
different; this table does not claim their extra cost disappeared.

| Case | Baseline snapshot bytes | Candidate bytes | Checkpoint child RSS MiB, baseline -> candidate |
| --- | ---: | ---: | ---: |
| number-32 | 3267 | 3361 | 65.7 -> 77.1 |
| nested-128x8 | 4747 | 4841 | 64.2 -> 71.9 |
| wide-32x8 | 14260 | 14354 | 75.3 -> 86.3 |

Snapshot size increases by 94 bytes for the fingerprint. RSS values are sampled
per-process medians after the workload; they include runtime/JIT/dependency costs
and are not a retained-memory bound or a causal allocation breakdown.

### Optimization evidence

The first prototype used descriptor definitions for every copied array index and
recomputed a sorted canonical graph plus SHA-256 at every snapshot boundary. The
final code uses dense array copies, a shared bounded per-schema raw-JSON/hash cache
and dense descriptor validation with one strict-subtree lookup per container.
No revision API, proxy layer, stale-reference shortcut or per-Function cache was
introduced. Invalid finite-JSON/coercion cases were strengthened during this work.

| Diagnostic operation | First prototype us | Final us | Reduction |
| --- | ---: | ---: | ---: |
| extract, wide-32x8 | 931.54 | 460.52 | 50.6% |
| restore, wide-32x8 | 912.64 | 464.14 | 49.1% |
| checkpoint, wide-32x8 | 1947.98 | 996.46 | 48.8% |

Initial prototypes were diagnostic snapshots, not accepted implementations. The
last small optimization was separately paired against the corrected a550963
candidate: numeric/wide snapshot operations improved about 4-6%, nested about
1-3%. Historical failed diagnostics remain evidence; none is reported as a pass.

## Process, rejection and retention probes

The POSIX process probe on macOS passed all six cases: clean control plus SIGKILL before
start, after fake start/lost response, after B/before A's tail, before commit and
after commit. All 18 children settled (five intentional -9 exits; remaining exits
0). Every recovered snapshot matched the control, the earlier committed Seed ran
once and one fake agent effect remained. Duplicate commands read the receipt and
did not replay. Guard `1794048915360-22684.json` exited 0.

The retention probes ran eight sequential children, 13 diagnostic epochs each,
with forced GC between epochs. Candidate results:

| Workload | Heap delta bytes, first -> last epoch | Promise count, first -> last | RSS MiB, first -> last |
| --- | ---: | ---: | ---: |
| memory-nested-128x8 | 86997 | 182 -> 187 | 71.9 -> 80.2 |
| memory-unawaited-16 | 4505 | 182 -> 182 | 64.5 -> 71.6 |
| snapshot-memory-nested-128x8 | 49310 | 182 -> 187 | 64.8 -> 72.0 |
| snapshot-memory-wide-32x8 | 145226 | 182 -> 187 | 71.5 -> 87.6 |

No linear Function-history accumulation was observed in these probes. Heap deltas
are endpoint observations, not universal leak proofs; RSS rose and is reported
rather than hidden. The memory guard `1794048903491-22446.json` exited 0 and
observed 98.7 MiB peak for the owned process group.

The portable benchmark child was additionally checked with guarded fixture
preparation and a short nested checkpoint smoke; both processes/guards exited 0.
Its single-operation timing samples are not used as benchmark results.

The candidate-only error probe used seven samples after warmup, 5000 operations
per sample; process and guard exited 0:

| Rejection | Median us |
| --- | ---: |
| busy-trigger | 0.537 |
| busy-extract | 0.338 |
| failed-trigger | 0.531 |
| failed-extract | 0.334 |
| invalid-snapshot | 4.419 |

These paths have different semantics from the old Worker and have no invented
baseline comparison. The probe also checked error codes and preserved the active
trigger's original input despite busy rejections. Raw samples, process traces and
retention epochs are included in the machine-readable results.

## Limits

- macOS execution is measured; Windows and Linux runtime acceptance is NOT_RUN.
- Fake agent/command files and in-memory test stores demonstrate the integration
  boundary, not production Flow durability, authorization or a provider adapter.
- Exactly-once external execution, durable mid-trigger budget/stack continuation,
  repeated Join generations and arbitrary detached IO are not provided.
- Benchmark results establish these workloads on this host, not universal product
  readiness or a fixed performance budget.
