export interface WorkerSnapshot {
  pinCache: { uuid: string; cache: any }[];
  metaCache: { uuid: string; cache: any }[];
}
