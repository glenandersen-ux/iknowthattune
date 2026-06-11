import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaveformVisualizer } from './WaveformVisualizer';

describe('WaveformVisualizer', () => {
  it('renders a canvas element', () => {
    render(<WaveformVisualizer getData={() => new Uint8Array(8)} isActive={false} />);
    expect(screen.getByTestId('waveform-canvas')).toBeInTheDocument();
  });

  it('does not call getData when inactive', () => {
    const getData = vi.fn(() => new Uint8Array(8));
    render(<WaveformVisualizer getData={getData} isActive={false} />);
    expect(getData).not.toHaveBeenCalled();
  });

  it('calls getData at least once when active', () => {
    const getData = vi.fn(() => new Uint8Array(8));
    render(<WaveformVisualizer getData={getData} isActive />);
    expect(getData).toHaveBeenCalled();
  });
});
