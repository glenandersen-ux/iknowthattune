import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClipExtendBar } from './ClipExtendBar';

describe('ClipExtendBar', () => {
  it('shows the next duration and the cost of the first extension', () => {
    render(<ClipExtendBar currentDuration="1s" clipExtensions={0} onExtend={vi.fn()} />);
    expect(screen.getByText('Hear 3s')).toBeInTheDocument();
    expect(screen.getByText('−100 pts')).toBeInTheDocument();
  });

  it('shows the marginal cost for subsequent extensions', () => {
    render(<ClipExtendBar currentDuration="3s" clipExtensions={1} onExtend={vi.fn()} />);
    expect(screen.getByText('Hear 5s')).toBeInTheDocument();
    expect(screen.getByText('−150 pts')).toBeInTheDocument();
  });

  it('is disabled once the 30s clip has been reached', () => {
    render(<ClipExtendBar currentDuration="30s" clipExtensions={4} onExtend={vi.fn()} />);
    const button = screen.getByTestId('clip-extend-bar');
    expect(button).toBeDisabled();
    expect(screen.getByText('Max clip length')).toBeInTheDocument();
  });

  it('calls onExtend when clicked', () => {
    const onExtend = vi.fn();
    render(<ClipExtendBar currentDuration="1s" clipExtensions={0} onExtend={onExtend} />);
    fireEvent.click(screen.getByTestId('clip-extend-bar'));
    expect(onExtend).toHaveBeenCalledOnce();
  });
});
