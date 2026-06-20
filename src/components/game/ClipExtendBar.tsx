import { CUMULATIVE_CLIP_PENALTIES } from '../../engine/ScoringEngine';
import type { ClipDuration } from '../../types/track';

const CLIP_DURATIONS: ClipDuration[] = ['1s', '3s', '5s', '10s', '30s'];

export interface ClipExtendBarProps {
  currentDuration: ClipDuration;
  clipExtensions: number;
  onExtend: () => void;
}

function nextExtensionCost(clipExtensions: number): number {
  const previous = clipExtensions > 0 ? CUMULATIVE_CLIP_PENALTIES[clipExtensions - 1] : 0;
  const index = Math.min(clipExtensions, CUMULATIVE_CLIP_PENALTIES.length - 1);
  return CUMULATIVE_CLIP_PENALTIES[index] - previous;
}

/** "Hear More" button — shows the next clip duration and its point penalty. */
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
      data-testid="clip-extend-bar"
      className="flex w-full items-center justify-between rounded-xl px-4 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: 'var(--color-stage-card)',
        border: '1px solid var(--color-stage-border)',
      }}
    >
      <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
        <span style={{ opacity: 0.6 }}>♪</span>
        {disabled ? 'Max clip length' : `Hear ${nextDuration}`}
      </span>
      {!disabled && (
        <span
          className="text-sm font-bold"
          style={{ color: 'var(--color-incorrect)', fontFamily: 'var(--font-display)' }}
        >
          −{cost} pts
        </span>
      )}
    </button>
  );
}
