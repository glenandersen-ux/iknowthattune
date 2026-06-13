import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MultiplierBackground } from './MultiplierBackground';

describe('MultiplierBackground', () => {
  it('renders the current multiplier value', () => {
    render(<MultiplierBackground multiplier={1.8} isActive />);
    expect(screen.getByText('1.8×')).toBeInTheDocument();
  });

  it('shrinks the fill bar as the multiplier decays from max toward the floor', () => {
    render(<MultiplierBackground multiplier={2.0} isActive />);
    const fullBar = screen.getByTestId('multiplier-bar');
    expect(fullBar.style.width).toBe('100%');

    render(<MultiplierBackground multiplier={0.5} isActive />);
    const emptyBars = screen.getAllByTestId('multiplier-bar');
    expect(emptyBars[emptyBars.length - 1].style.width).toBe('0%');
  });

  it('holds the bar at full width while inactive', () => {
    render(<MultiplierBackground multiplier={0.5} isActive={false} />);
    expect(screen.getByTestId('multiplier-bar').style.width).toBe('100%');
  });
});
