/** Cache values only: does not persist a run, budget, callback, or pending continuation. */
export interface WorkerSnapshot {
  schemaFingerprint: string;
  pinCache: { uuid: string; cache: any }[];
  metaCache: { uuid: string; cache: any }[];
}
