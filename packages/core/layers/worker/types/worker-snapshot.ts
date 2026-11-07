import type { JsonValue } from "../snapshot-json";

/** Independent JSON caches at a completed trigger boundary, never a JS continuation. */
export interface WorkerSnapshot {
  schemaFingerprint: string;
  pinCache: { uuid: string; cache: JsonValue }[];
  metaCache: { uuid: string; cache: JsonValue }[];
}
