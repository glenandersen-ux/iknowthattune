import clsx from 'clsx';
import { MAX_SPEED_MULTIPLIER, MIN_SPEED_MULTIPLIER } from '../../engine/ScoringEngine';

export interface MultiplierBackgroundProps {
  /**
   * Current speed multiplier (DeepDive §A.4), recomputed every animation
   * frame by the caller via `ScoringEngine.computeSpeedMultiplier`.
   */
  multiplier: number;
  /** Whether playback is active; the bar holds at full width while idle. */
  isActive: boolean;
}

/**
 * Digital "bonus meter" background shown while a clip plays: a shrinking
 * fill bar plus a large multiplier readout, replacing the waveform so
 * players can see their speed bonus draining in real time.
 */
export function MultiplierBackground({ multiplier, isActive }: MultiplierBackgroundProps): React.ReactElement {
  const range = MAX_SPEED_MULTIPLIER - MIN_SPEED_MULTIPLIER;
  const ratio = isActive ? Math.min(Math.max((multiplier - MIN_SPEED_MULTIPLIER) / range, 0), 1) : 1;
  const colorClass = multiplier > 1.5 ? 'text-green-400' : multiplier >= 1.0 ? 'text-yellow-400' : 'text-red-400';
  const barColorClass = multiplier > 1.5 ? 'bg-green-400' : multiplier >= 1.0 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div
      className="relative flex h-15 w-full items-center justify-center overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-950 [background-image:linear-gradient(0deg,rgba(34,211,238,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.12)_1px,transparent_1px)] [background-size:12px_12px]"
      data-testid="multiplier-background"
    >
      <div
        className={clsx('absolute inset-y-0 left-0 opacity-25 transition-[width] duration-150 ease-linear', barColorClass)}
        style={{ width: `${ratio * 100}%` }}
        data-testid="multiplier-bar"
      />
      <span className={clsx('relative font-mono text-3xl font-bold tracking-widest tabular-nums', colorClass)}>
        {multiplier.toFixed(1)}×
      </span>
    </div>
  );
}
