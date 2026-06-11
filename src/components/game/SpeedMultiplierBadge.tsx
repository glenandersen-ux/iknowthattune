import clsx from 'clsx';

export interface SpeedMultiplierBadgeProps {
  /**
   * Current speed multiplier (DeepDive §A.4). The caller recomputes this on
   * every animation frame via `ScoringEngine.computeSpeedMultiplier` driven
   * by `AudioContext.currentTime`, so this component re-renders continuously
   * without needing its own clock.
   */
  multiplier: number;
}

/** Live "x.x×" badge. Color shifts green (>1.5×) -> yellow (1.0-1.5×) -> red (<1.0×). */
export function SpeedMultiplierBadge({ multiplier }: SpeedMultiplierBadgeProps): React.ReactElement {
  const colorClass =
    multiplier > 1.5 ? 'text-green-400' : multiplier >= 1.0 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div
      className={clsx('font-mono font-bold text-lg tabular-nums', colorClass)}
      data-testid="speed-multiplier-badge"
    >
      {multiplier.toFixed(1)}×
    </div>
  );
}
