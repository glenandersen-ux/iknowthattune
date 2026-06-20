import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClipPlayer } from './ClipPlayer';

const preloadTrack = vi.fn().mockResolvedValue(undefined);
const unlock = vi.fn().mockResolvedValue(undefined);
const play = vi.fn().mockResolvedValue(undefined);
const stop = vi.fn();

vi.mock('../../engine/AudioEngine', () => ({
  AudioEngine: vi.fn().mockImplementation(function MockAudioEngine() {
    return { preloadTrack, unlock, play, stop };
  }),
}));

const fetchSpotifyPreview = vi.fn();
vi.mock('../../engine/SpotifyPreview', () => ({
  fetchSpotifyPreview: (...args: unknown[]) => fetchSpotifyPreview(...args),
}));

const fetchItunesPreview = vi.fn();
vi.mock('../../engine/ItunesPreview', () => ({
  fetchItunesPreview: (...args: unknown[]) => fetchItunesPreview(...args),
}));

const clipUrls = { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' };
const spotifyPreviewData = {
  previewUrl: 'https://p.scdn.co/mp3-preview/abc123',
  trackUrl: 'https://open.spotify.com/track/123',
  trackName: 'Some Song',
  artistName: 'Some Artist',
};
const itunesPreviewData = {
  previewUrl: 'https://audio.example/preview.m4a',
  trackViewUrl: 'https://music.apple.com/track/1',
};

describe('ClipPlayer', () => {
  beforeEach(() => {
    preloadTrack.mockClear();
    preloadTrack.mockResolvedValue(undefined);
    unlock.mockClear();
    play.mockClear();
    stop.mockClear();
    fetchSpotifyPreview.mockReset();
    fetchItunesPreview.mockReset();
  });

  // ── catalog-only path (no fallback props) ─────────────────────────────────

  it('preloads all clip durations on mount using catalog URLs', async () => {
    render(
      <ClipPlayer clipUrls={clipUrls} currentDuration="1s" onPlaybackStart={vi.fn()} onPlaybackEnd={vi.fn()} onExtendRequest={vi.fn()} />,
    );
    await waitFor(() => expect(preloadTrack).toHaveBeenCalledWith(clipUrls));
  });

  it('shows a "Start" button before the audio context is unlocked', async () => {
    render(
      <ClipPlayer clipUrls={clipUrls} currentDuration="1s" onPlaybackStart={vi.fn()} onPlaybackEnd={vi.fn()} onExtendRequest={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());
  });

  it('passes the clip start offset (in seconds) to the audio engine', async () => {
    render(
      <ClipPlayer clipUrls={clipUrls} currentDuration="5s" clipStartOffsetMs={1500} onPlaybackStart={vi.fn()} onPlaybackEnd={vi.fn()} onExtendRequest={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('tap-to-start'));
    await waitFor(() => expect(play).toHaveBeenCalledWith('5s', 1.5));
  });

  it('unlocks audio and plays the clip on tap, then calls playback callbacks', async () => {
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    render(
      <ClipPlayer clipUrls={clipUrls} currentDuration="1s" onPlaybackStart={onPlaybackStart} onPlaybackEnd={onPlaybackEnd} onExtendRequest={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('tap-to-start'));
    await waitFor(() => expect(unlock).toHaveBeenCalledOnce());
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledWith('1s', 0);
    await waitFor(() => expect(onPlaybackEnd).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('tap-to-start')).not.toBeInTheDocument();
  });

  it('shows an error overlay and advances playback callbacks if catalog preloading fails', async () => {
    preloadTrack.mockRejectedValueOnce(new Error('Failed to preload any clip durations'));
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    render(
      <ClipPlayer clipUrls={clipUrls} currentDuration="1s" onPlaybackStart={onPlaybackStart} onPlaybackEnd={onPlaybackEnd} onExtendRequest={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('clip-error')).toBeInTheDocument());
    expect(screen.queryByTestId('tap-to-start')).not.toBeInTheDocument();
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
  });

  // ── Spotify primary source ────────────────────────────────────────────────

  it('uses Spotify as the primary audio source and shows the Spotify badge', async () => {
    fetchSpotifyPreview.mockResolvedValueOnce(spotifyPreviewData);
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={vi.fn()}
        onPlaybackEnd={vi.fn()}
        onExtendRequest={vi.fn()}
        fallbackSongTitle="Some Song"
        fallbackArtistName="Some Artist"
      />,
    );
    expect(fetchSpotifyPreview).toHaveBeenCalledWith('Some Song', 'Some Artist');
    await waitFor(() => expect(screen.getByTestId('spotify-badge')).toBeInTheDocument());
    expect(screen.getByTestId('spotify-badge')).toHaveAttribute('href', 'https://open.spotify.com/track/123');
    expect(preloadTrack).toHaveBeenCalledWith(
      expect.objectContaining({ '1s': 'https://p.scdn.co/mp3-preview/abc123' }),
    );
    expect(screen.queryByTestId('itunes-fallback-badge')).not.toBeInTheDocument();
  });

  // ── iTunes fallback when Spotify unavailable ──────────────────────────────

  it('falls back to catalog URLs when Spotify has no preview, then iTunes if catalog also fails', async () => {
    fetchSpotifyPreview.mockResolvedValueOnce(null);                          // Spotify: no preview
    preloadTrack.mockRejectedValueOnce(new Error('catalog failed'));           // catalog: fails
    preloadTrack.mockResolvedValueOnce(undefined);                            // iTunes URL: succeeds
    fetchItunesPreview.mockResolvedValueOnce(itunesPreviewData);

    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={vi.fn()}
        onPlaybackEnd={vi.fn()}
        onExtendRequest={vi.fn()}
        fallbackSongTitle="Some Song"
        fallbackArtistName="Some Artist"
      />,
    );

    await waitFor(() => expect(fetchItunesPreview).toHaveBeenCalledWith('Some Song', 'Some Artist'));
    await waitFor(() => expect(screen.getByTestId('itunes-fallback-badge')).toBeInTheDocument());
    expect(screen.queryByTestId('spotify-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('clip-error')).not.toBeInTheDocument();
  });

  it('shows the error overlay when Spotify, catalog, and iTunes all fail', async () => {
    fetchSpotifyPreview.mockResolvedValueOnce(null);
    preloadTrack.mockRejectedValueOnce(new Error('catalog failed'));
    fetchItunesPreview.mockResolvedValueOnce(null);
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={onPlaybackStart}
        onPlaybackEnd={onPlaybackEnd}
        onExtendRequest={vi.fn()}
        fallbackSongTitle="Some Song"
        fallbackArtistName="Some Artist"
      />,
    );
    await waitFor(() => expect(screen.getByTestId('clip-error')).toBeInTheDocument());
    expect(screen.queryByTestId('spotify-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('itunes-fallback-badge')).not.toBeInTheDocument();
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
  });

  // ── generic playback controls ─────────────────────────────────────────────

  it('shows a Stop button while playing, and stopping ends playback early', async () => {
    let resolvePlay: (() => void) | undefined;
    play.mockImplementationOnce(() => new Promise<void>((resolve) => (resolvePlay = resolve)));
    const onPlaybackEnd = vi.fn();
    render(
      <ClipPlayer clipUrls={clipUrls} currentDuration="1s" onPlaybackStart={vi.fn()} onPlaybackEnd={onPlaybackEnd} onExtendRequest={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('tap-to-start'));
    await waitFor(() => expect(screen.getByTestId('stop-button')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('stop-button'));
    expect(stop).toHaveBeenCalled();
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('stop-button')).not.toBeInTheDocument();
    resolvePlay?.();
    await Promise.resolve();
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
  });

  it('shows the live multiplier in the background while playing', async () => {
    let resolvePlay: (() => void) | undefined;
    play.mockImplementationOnce(() => new Promise<void>((resolve) => (resolvePlay = resolve)));
    render(
      <ClipPlayer clipUrls={clipUrls} currentDuration="1s" multiplier={1.7} onPlaybackStart={vi.fn()} onPlaybackEnd={vi.fn()} onExtendRequest={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('tap-to-start'));
    await waitFor(() => expect(screen.getByText('1.7×')).toBeInTheDocument());
    resolvePlay?.();
  });

  it('shows an error overlay if play() rejects mid-playback', async () => {
    play.mockRejectedValueOnce(new Error('Clip 1s not preloaded'));
    const onPlaybackEnd = vi.fn();
    render(
      <ClipPlayer clipUrls={clipUrls} currentDuration="1s" onPlaybackStart={vi.fn()} onPlaybackEnd={onPlaybackEnd} onExtendRequest={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('tap-to-start'));
    await waitFor(() => expect(screen.getByTestId('clip-error')).toBeInTheDocument());
    expect(onPlaybackEnd).not.toHaveBeenCalled();
  });
});
