/** Cache values only. The caller must discard stale snapshots and Workers when the graph changes. */
export interface WorkerSnapshot {
  pinCache: { uuid: string; cache: any }[];
  metaCache: { uuid: string; cache: any }[];
}
