import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpotifyBadge } from './SpotifyBadge';

describe('SpotifyBadge', () => {
  it('renders a link to the Spotify track page', () => {
    render(
      <SpotifyBadge
        trackUrl="https://open.spotify.com/track/123"
        trackName="Rolling in the Deep"
        artistName="Adele"
      />,
    );
    const badge = screen.getByTestId('spotify-badge');
    expect(badge).toHaveAttribute('href', 'https://open.spotify.com/track/123');
    expect(badge).toHaveAttribute('target', '_blank');
    expect(badge).toHaveAccessibleName(/Rolling in the Deep/);
    expect(badge).toHaveAccessibleName(/Adele/);
    expect(badge).toHaveTextContent('Listen on Spotify');
  });
});
