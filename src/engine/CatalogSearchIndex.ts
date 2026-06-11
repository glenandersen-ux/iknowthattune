import Fuse, { type FuseIndex, type IFuseOptions } from 'fuse.js';
import type { Track } from '../types/track';

/** Shared Fuse.js config for catalog search (TechStack §D.6), used by both the
 * main thread and {@link ../workers/catalogIndexWorker}. */
export const FUSE_OPTIONS: IFuseOptions<Track> = {
  keys: [
    'answers.song_title.value',
    'answers.song_title.aliases',
    'answers.primary_artist.value',
    'answers.primary_artist.aliases',
    'answers.album_name.value',
  ],
  threshold: 0.3,
};

export type SerializedFuseIndex = ReturnType<FuseIndex<Track>['toJSON']>;

/** Builds a serializable Fuse index, suitable for `postMessage` from a Web Worker. */
export function buildSerializedFuseIndex(tracks: Track[]): SerializedFuseIndex {
  return Fuse.createIndex(FUSE_OPTIONS.keys ?? [], tracks).toJSON();
}

/** Reconstructs a `Fuse` instance on the main thread from a worker-built index. */
export function hydrateFuseIndex(tracks: Track[], serialized: SerializedFuseIndex): Fuse<Track> {
  const index = Fuse.parseIndex<Track>(serialized);
  return new Fuse(tracks, FUSE_OPTIONS, index);
}
