# COM-0008 verification

## Workflow pilot: bounded improvements, PERF_NOT_ACCEPTED

Production: `e3e851911db9ca793a55334e3bb8231966457451`; fixed master:
`af9ce9bcded35b5ead9020215cf24f2f2ba7f51a`; pilot start:
`d6a2a9ae77eba67fe9f4c73d7a21db21c44e075b`. Post-hook hashes match the
measured source. The PR remains draft. No Schema ownership/live-reference, public
API, snapshot JSON, detachment or exec guarantee changed.

Two small changes were retained: avoid rereading known descriptors while counting
extra optional metadata, and delay creating a validation worklist until nested or
custom work exists. Field/property read order, errors and LIFO order are preserved.
No source alias memo or persistent key cache was added.

### Independent master/start/candidate results

Five rotating-order triples / 240 sequential children and the guard exited 0.
The same fixed SchemaSnapshots and graph/pin/meta hashes were used. Seven timed
samples follow warmup in each child. Times below are medians of child medians.
[Sanitized pilot evidence](com0008-workflow-pilot.json) contains all 240 raw runs,
paired ranges, warmup/counts, bytes, RSS and the full 16-scenario summary.

| Checkpoint | Master us | Start us | Candidate us | vs master | vs start | Candidate RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| number-32 | 21.343 | 129.662 | 129.136 | 6.051x | 0.996x | 72.5 |
| wide-32x8 | 61.915 | 532.878 | 527.968 | 8.527x | 0.991x | 80.8 |
| nested-128x8 | 26.750 | 178.124 | 181.423 | 6.782x | 1.019x | 67.8 |

Against start, ordinary number/wide/event/Pure triggers improve in every pair:
candidate/start ranges 0.956-0.989 / 0.945-0.989 / 0.916-0.956 / 0.948-0.971.
Unawaited pairs are mixed; empty/nested do not establish improvement. Snapshot
differences are mostly noise. Checkpoint still costs 6.05-8.53x master; event-only
and nested triggers remain about 1.31x and 1.44x master. Performance/task acceptance
is not claimed. RSS is a child endpoint observation, not a memory bound.

### Experiments, remaining cost and options

- H1 helps API-built graphs retaining optional undefined fields (~0.725x in the
  256-node comparison). JSON-loaded fixtures already omit those fields; no general
  checkpoint gain is attributed to H1.
- H2 scalar/null/Any micro cases consistently improved (~4-5 ns vs ~8-10 ns).
  Nested/custom aggregate medians reflect JIT convergence and are not stable gains.
  Getter/error/LIFO observation traces matched.
- H3 private previous-object key memo regressed the wide case in every pair and
  was rejected. Earlier fused-visitor/bulk-descriptor variants remain rejected.

Indicative components still put warm graph comparison near 42/176/17 us for
number/wide/nested and nested cache detachment near 45 us. These independent micro
operations have different optimizer/retention conditions: they are not additive,
an exact savings bound, or proof of optimality/impossibility. Current code still
inspects live graph descriptors and independently copies cache values.

Next permitted options are further internal comparison/detachment work under the
same guarantees, or a separately tested restore-envelope codec preserving complete
validation/error order. No codec was implemented or gain promised. A decision on
cost/guarantee tradeoffs or a controlled ownership proposal is another option, not
a prerequisite for continuing permitted internal work. Architecture is unchanged.

### Verification and limits

- Full guarded suite: 348 PASS / 0 FAIL / 4095 assertions. Typecheck, browser-target
  bundle and normal commit hooks exit 0. Browser runtime itself is NOT_RUN.
- Mac/POSIX recovery: 18 settled children, five intentional SIGKILL barriers,
  identical recovered snapshots and one fake agent effect; exit 0.
- Memory: 12 sequential children exit 0; fixed-size graph replacement ran 13
  epochs per mode. No linear Promise/history accumulation was observed in these
  bounded probes. RSS increases and raw endpoints remain visible.
- Worker coverage: 27/27 functions, 516/516 lines; helper: 11/11 and 186/186.
  Validator: 10/13 functions, 430/431 lines. Existing gaps and unavailable Bun
  branch/statement metrics mean no all-file/all-metric 80% acceptance.
- Windows/Linux and real Flow/Agents remain NOT_RUN.
- Initial archive setup could not resolve ulid. The failed run is retained; its
  dependency link was repaired without package changes.
- Independent review accepts correctness/scope, not performance. One ordered
  pilot does not prove a causal effect of the skill; prior context, coordinator
  feedback and extra review attention are confounds. No approve/merge/release.

## Earlier performance follow-up (historical, PERF_NOT_ACCEPTED)

The PR is draft. The earlier correctness review did not establish acceptable
performance. The remaining snapshot regression against master is **not accepted**;
the stronger snapshot contract is not a performance approval. No merge or publish.

Correctness commit in this earlier follow-up: `4eda88a551cc74ca6ac5d0b8f4ef3963385e8bf7`. The full
guarded suite has 343 PASS / 0 FAIL; targeted boundary tests have 41 PASS / 0 FAIL.
Typecheck and ordinary commit hooks exit 0. Coverage has not been rerun on this
follow-up code. The exception-mapping fix received an independent scoped
correctness ACCEPT; this does not establish performance acceptance.

The intermediate commit `959e36f04d3842ebfa393d4c679aa665a2fff9f5` compares all
live descriptors/values against one detached previous graph. An unchanged graph
does not serialize or hash again. A difference still triggers complete JSON
validation before canonicalization. Extract builds its own wrappers and clones
only cache values; primitive values avoid unnecessary clone bookkeeping.
Caller JSON detachment and separate copies for repeated occurrences remain intact.

### Measured causes and experiments

Components are timed independently; they are not additive accounting. For the
old implementation, graph validation/serialization was about 82% of numeric/wide
extract cost. Nested extract instead spends a large part copying nested cached
values repeatedly. These measurements separate the causes rather than treating
the strict contract as sufficient justification.

| Component, us | Number | Wide | Nested |
| --- | ---: | ---: | ---: |
| graph-validate-serialize | 87.51 | 365.52 | 33.88 |
| cache-wrapper-clone | 7.68 | 34.51 | 45.72 |
| cache-typed-validate | 1.02 | 7.12 | 9.62 |
| input-detach | 0.06 | 0.73 | 4.88 |
| extract-whole | 106.14 | 446.89 | 98.44 |

Walking known previous keys improved the descriptor comparison about 5-6%; bulk
getOwnPropertyDescriptors was about 40% slower and was rejected. A separate fused
validate/compare/detach visitor reduced cold fingerprint time about 20-22%, but
made warm fingerprint time 25-54% slower. It was rejected from production. No
source-to-clone memo, public alias change, proxy layer or revision API was added.

The ordinary event-only regression is separate: the numeric input object must
be detached once at the trigger boundary. Descriptor copying is measured directly;
the primitive fast path does not eliminate object copying.

### Final focused pairs for current production

The exception-mapping commit 4eda88a was measured independently on the same fixed
SchemaSnapshots: five pairs / 90 sequential snapshot children, process and guard
exit 0. Guard `1794052216602-31322.json` observed 94.1 MiB peak. Fingerprint state
was warmed. These current measurements remain PERF_NOT_ACCEPTED.

| Case | Operation | Master us | 4eda88a us | Ratio |
| --- | --- | ---: | ---: | ---: |
| number-32 | extract | 1.38 | 50.03 | 36.38x |
| number-32 | restore | 1.73 | 58.24 | 33.69x |
| number-32 | checkpoint | 21.59 | 126.66 | 5.87x |
| nested-128x8 | extract | 1.00 | 72.27 | 72.31x |
| nested-128x8 | restore | 9.75 | 76.92 | 7.89x |
| nested-128x8 | checkpoint | 27.29 | 175.62 | 6.44x |
| wide-32x8 | extract | 4.51 | 203.47 | 45.13x |
| wide-32x8 | restore | 10.47 | 252.09 | 24.07x |
| wide-32x8 | checkpoint | 60.06 | 511.91 | 8.52x |

The final current POSIX/macOS recovery probe also exited 0: 18 children, five
intentional SIGKILL barriers, identical recovered snapshots and one fake agent
effect. Guard `1794052228006-31818.json`. This is a correctness result, not a
performance approval or a real Flow/Agents acceptance.

### Independent intermediate pairs against master

Five alternating pairs / 160 sequential children exited 0. These are measurements
of 959e36f, not the newer exception-mapping commit. Warm fingerprint state and
fixed shared SchemaSnapshots match the earlier benchmark method.

| Case | Operation | Master us | 959e36f us | Ratio |
| --- | --- | ---: | ---: | ---: |
| empty-32 | measure | 11.61 | 12.09 | 1.04x |
| number-32 | measure | 16.58 | 17.04 | 1.03x |
| wide-32x8 | measure | 45.90 | 48.17 | 1.05x |
| nested-128x8 | measure | 13.93 | 20.16 | 1.45x |
| event-32 | measure | 2.35 | 3.29 | 1.40x |
| pure-16 | measure | 3.82 | 4.11 | 1.07x |
| unawaited-16 | measure | 5.77 | 5.94 | 1.03x |
| number-32 | extract | 1.55 | 51.46 | 33.31x |
| nested-128x8 | extract | 0.98 | 74.54 | 76.38x |
| wide-32x8 | extract | 4.50 | 208.70 | 46.37x |
| number-32 | restore | 1.95 | 59.74 | 30.61x |
| nested-128x8 | restore | 9.70 | 76.96 | 7.93x |
| wide-32x8 | restore | 10.64 | 258.05 | 24.25x |
| number-32 | checkpoint | 21.53 | 130.33 | 6.05x |
| nested-128x8 | checkpoint | 26.72 | 179.39 | 6.71x |
| wide-32x8 | checkpoint | 59.94 | 530.29 | 8.85x |

The checkpoint still takes about 6-9 times master; extract/restore regressions
are also substantial. This is progress over the earlier implementation, not
performance acceptance. [Follow-up data](com0008-performance-followup.json)
preserves all component samples, comparison variants, rejected experiments and
pair ranges. The prior report/data below remain historical evidence.

### Retention and historical optional ownership proposal

Two fixed-size graph/default replacement probes ran 13 epochs of 200 mutations.
API replacement retained +79,759 heap bytes (Promises 177 -> 178); direct alias
replacement retained +30,602 bytes (Promises 178 -> 178). The guard exited 0.
No linear history accumulation was observed in these probes; this is not a
universal memory bound. An initial probe setup syntax failure is retained separately.

The intermediate 959e36f memory probes also completed eight sequential children
with guard exit 0 (`1794052070974-30623.json`, 91.6 MiB peak). Candidate endpoint
heap changes ranged from -793 to +83,540 bytes; Promise counts stayed near
179-184. RSS increases remain in the raw data. These probes were not rerun on the
exception-mapping commit and are not reported as a universal memory proof.

The current Schema exposes mutable references as well as explicit edit methods.
A revision counter alone cannot detect edits through those references. An ownership option was raised at that checkpoint; it was not approved and is
not a prerequisite for permitted internal optimization. No ownership, live-edit
or public API guarantee was changed. Windows/Linux and real Flow/Agents acceptance remain
NOT_RUN.

## Historical verification: 94b9401

Scope: Commutator library, tests and documentation. No production Flow/Agents,
storage, retries, Join, merge or package publication. Baseline is
`af9ce9bcded35b5ead9020215cf24f2f2ba7f51a`; production candidate is
`94b9401cfa9233224234168f54c0f4b3428d7904` for this historical section. The
follow-up above supersedes its performance acceptance interpretation.

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
recomputed a sorted canonical graph plus SHA-256 at every snapshot boundary. That
candidate uses dense array copies, a shared bounded per-schema raw-JSON/hash cache
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
