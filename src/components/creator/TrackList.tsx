import { useState, type DragEvent, type ReactNode, type JSX } from 'react';
import type { FieldId, Track } from '../../types/track';

const TOTAL_FIELD_COUNT = 19;
const DOT_COUNT = 4;
const AVG_SECONDS_PER_TRACK = 90;

export interface TrackListProps {
  tracks: Track[];
  activeParams: Record<string, FieldId[]>;
  onReorder: (tracks: Track[]) => void;
  onRemove: (trackId: string) => void;
  /** Renders the inline "Configure" panel for the currently expanded track. */
  renderConfig?: (track: Track) => ReactNode;
}

/** Renders `n` of `DOT_COUNT` filled dots, e.g. "●●●○". */
function paramDots(activeCount: number): string {
  const filled = activeCount === 0 ? 0 : Math.max(1, Math.round((activeCount / TOTAL_FIELD_COUNT) * DOT_COUNT));
  const clamped = Math.min(DOT_COUNT, filled);
  return '●'.repeat(clamped) + '○'.repeat(DOT_COUNT - clamped);
}

/** Formats a total clip count into "Xm Ys" using the average 90s/track estimate. */
function formatEstimatedTime(trackCount: number): string {
  const totalSeconds = trackCount * AVG_SECONDS_PER_TRACK;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

/** Track list / reorder screen for the Challenge Creator wizard (DeepDive §B.3). */
export function TrackList({ tracks, activeParams, onReorder, onRemove, renderConfig }: TrackListProps): JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (event: DragEvent<HTMLLIElement>): void => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: DragEvent<HTMLLIElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index: number) => (event: DragEvent<HTMLLIElement>): void => {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const next = [...tracks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    onReorder(next);
    setDragIndex(null);
  };

  const toggleExpanded = (trackId: string): void => {
    setExpandedId((current) => (current === trackId ? null : trackId));
  };

  return (
    <div className="flex flex-col gap-3 text-white">
      <ul className="flex flex-col gap-2">
        {tracks.map((track, index) => {
          const title = track.answers.song_title.value ?? 'Unknown';
          const artist = track.answers.primary_artist.value ?? 'Unknown';
          const isExpanded = expandedId === track.track_id;
          return (
            <li
              key={track.track_id}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(index)}
              data-testid={`track-row-${track.track_id}`}
              className="rounded-lg bg-slate-800"
            >
              <div className="flex items-center gap-3 p-3">
                <span className="cursor-grab text-slate-500" aria-hidden="true">
                  ⠿
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-slate-400">{artist}</span>
                </div>
                <span data-testid={`param-dots-${track.track_id}`} className="text-cyan-400" aria-label="Active parameters">
                  {paramDots((activeParams[track.track_id] ?? []).length)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpanded(track.track_id)}
                  className="rounded-full bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
                >
                  Configure {isExpanded ? '▴' : '▾'}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(track.track_id)}
                  aria-label={`Remove ${title}`}
                  className="rounded-full bg-slate-700 px-2 py-1 text-sm text-red-400 hover:bg-slate-600"
                >
                  ✕
                </button>
              </div>
              {isExpanded && renderConfig && <div className="border-t border-slate-700 p-3">{renderConfig(track)}</div>}
            </li>
          );
        })}
        {tracks.length === 0 && <li className="text-center text-sm text-slate-500">No tracks added yet.</li>}
      </ul>

      <p className="text-center text-sm text-slate-400">
        {tracks.length} track{tracks.length === 1 ? '' : 's'} · ~{formatEstimatedTime(tracks.length)}
      </p>
    </div>
  );
}
