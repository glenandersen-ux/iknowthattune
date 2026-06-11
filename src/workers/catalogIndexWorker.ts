import { buildSerializedFuseIndex, type SerializedFuseIndex } from '../engine/CatalogSearchIndex';
import type { Track } from '../types/track';

export interface CatalogIndexRequest {
  tracks: Track[];
}

export interface CatalogIndexResponse {
  index: SerializedFuseIndex;
}

/** Builds the catalog's Fuse index off the main thread (Phase 4 §4.3). */
self.onmessage = (event: MessageEvent<CatalogIndexRequest>): void => {
  const response: CatalogIndexResponse = { index: buildSerializedFuseIndex(event.data.tracks) };
  self.postMessage(response);
};
