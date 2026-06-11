import { CUMULATIVE_CLIP_PENALTIES } from '../../engine/ScoringEngine';
import type { ClipDuration } from '../../types/track';

const CLIP_DURATIONS: ClipDuration[] = ['1s', '3s', '5s', '10s', '30s'];

export interface ClipExtendBarProps {
  /** The clip duration currently playing. */
  currentDuration: ClipDuration;
  /** Number of "Hear More" extensions already used on this track. */
  clipExtensions: number;
  onExtend: () => void;
}

/** Marginal point cost of the next extension, derived from the cumulative penalty table (DeepDive §A.5). */
function nextExtensionCost(clipExtensions: number): number {
  const previous = clipExtensions > 0 ? CUMULATIVE_CLIP_PENALTIES[clipExtensions - 1] : 0;
  const index = Math.min(clipExtensions, CUMULATIVE_CLIP_PENALTIES.length - 1);
  return CUMULATIVE_CLIP_PENALTIES[index] - previous;
}

/** "Hear More" control showing the next clip duration and its point cost. */
export function ClipExtendBar({ currentDuration, clipExtensions, onExtend }: ClipExtendBarProps): React.ReactElement {
  const currentIndex = CLIP_DURATIONS.indexOf(currentDuration);
  const nextDuration = CLIP_DURATIONS[currentIndex + 1];
  const disabled = nextDuration === undefined;
  const cost = nextExtensionCost(clipExtensions);

  return (
    <button
      type="button"
      onClick={onExtend}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
      data-testid="clip-extend-bar"
    >
      <span>
        {disabled ? 'Max clip length reached' : `Hear More → ${nextDuration}`}
      </span>
      {!disabled && <span className="text-red-400">−{cost} pts</span>}
    </button>
  );
}
