import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppleMusicLink } from './AppleMusicLink';

const fetchItunesPreview = vi.fn();

vi.mock('../../engine/ItunesPreview', () => ({
  fetchItunesPreview: (...args: unknown[]) => fetchItunesPreview(...args),
}));

describe('AppleMusicLink', () => {
  beforeEach(() => {
    fetchItunesPreview.mockReset();
  });

  it('renders a link to the Apple Music track page when found', async () => {
    fetchItunesPreview.mockResolvedValueOnce({
      previewUrl: 'https://audio.example/preview.m4a',
      trackViewUrl: 'https://music.apple.com/track/1',
    });

    render(<AppleMusicLink songTitle="Some Song" artistName="Some Artist" />);

    expect(fetchItunesPreview).toHaveBeenCalledWith('Some Song', 'Some Artist');
    await waitFor(() => expect(screen.getByTestId('apple-music-link')).toBeInTheDocument());
    expect(screen.getByTestId('apple-music-link')).toHaveAttribute('href', 'https://music.apple.com/track/1');
    expect(screen.getByTestId('apple-music-link')).toHaveAttribute('target', '_blank');
  });

  it('renders nothing when no match is found', async () => {
    fetchItunesPreview.mockResolvedValueOnce(null);

    render(<AppleMusicLink songTitle="Some Song" artistName="Some Artist" />);

    await waitFor(() => expect(fetchItunesPreview).toHaveBeenCalled());
    expect(screen.queryByTestId('apple-music-link')).not.toBeInTheDocument();
  });
});
