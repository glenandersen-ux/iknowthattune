import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeedMultiplierBadge } from './SpeedMultiplierBadge';

describe('SpeedMultiplierBadge', () => {
  it('renders the multiplier formatted to one decimal', () => {
    render(<SpeedMultiplierBadge multiplier={2.0} />);
    expect(screen.getByTestId('speed-multiplier-badge')).toHaveTextContent('2.0×');
  });

  it('shows green for multipliers above 1.5', () => {
    render(<SpeedMultiplierBadge multiplier={1.8} />);
    expect(screen.getByTestId('speed-multiplier-badge')).toHaveClass('text-green-400');
  });

  it('shows yellow for multipliers between 1.0 and 1.5', () => {
    render(<SpeedMultiplierBadge multiplier={1.2} />);
    expect(screen.getByTestId('speed-multiplier-badge')).toHaveClass('text-yellow-400');
  });

  it('shows red for multipliers below 1.0', () => {
    render(<SpeedMultiplierBadge multiplier={0.5} />);
    expect(screen.getByTestId('speed-multiplier-badge')).toHaveClass('text-red-400');
  });
});
