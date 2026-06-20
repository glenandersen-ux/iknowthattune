import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeezerBadge } from './DeezerBadge';

describe('DeezerBadge', () => {
  it('renders a link to the Deezer track page', () => {
    render(
      <DeezerBadge
        trackUrl="https://www.deezer.com/track/123"
        trackName="Rolling in the Deep"
        artistName="Adele"
      />,
    );
    const badge = screen.getByTestId('deezer-badge');
    expect(badge).toHaveAttribute('href', 'https://www.deezer.com/track/123');
    expect(badge).toHaveAttribute('target', '_blank');
    expect(badge).toHaveAccessibleName(/Rolling in the Deep/);
    expect(badge).toHaveTextContent('Listen on Deezer');
  });
});
