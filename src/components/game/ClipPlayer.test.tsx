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
    return {
      preloadTrack,
      unlock,
      play,
      stop,
    };
  }),
}));

const fetchItunesPreview = vi.fn();

vi.mock('../../engine/ItunesPreview', () => ({
  fetchItunesPreview: (...args: unknown[]) => fetchItunesPreview(...args),
}));

const clipUrls = { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' };

describe('ClipPlayer', () => {
  beforeEach(() => {
    preloadTrack.mockClear();
    preloadTrack.mockResolvedValue(undefined);
    unlock.mockClear();
    play.mockClear();
    stop.mockClear();
    fetchItunesPreview.mockReset();
  });

  it('preloads all clip durations on mount', async () => {
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={vi.fn()}
        onPlaybackEnd={vi.fn()}
        onExtendRequest={vi.fn()}
      />,
    );
    await waitFor(() => expect(preloadTrack).toHaveBeenCalledWith(clipUrls));
  });

  it('shows a "Start" button before the audio context is unlocked', async () => {
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={vi.fn()}
        onPlaybackEnd={vi.fn()}
        onExtendRequest={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());
  });

  it('passes the clip start offset (in seconds) to the audio engine', async () => {
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="5s"
        clipStartOffsetMs={1500}
        onPlaybackStart={vi.fn()}
        onPlaybackEnd={vi.fn()}
        onExtendRequest={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());

    await userEvent.click(screen.getByTestId('tap-to-start'));

    await waitFor(() => expect(play).toHaveBeenCalledWith('5s', 1.5));
  });

  it('unlocks audio and plays the clip on tap, then calls playback callbacks', async () => {
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={onPlaybackStart}
        onPlaybackEnd={onPlaybackEnd}
        onExtendRequest={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());

    await userEvent.click(screen.getByTestId('tap-to-start'));

    await waitFor(() => expect(unlock).toHaveBeenCalledOnce());
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledWith('1s', 0);
    await waitFor(() => expect(onPlaybackEnd).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('tap-to-start')).not.toBeInTheDocument();
  });

  it('shows an error overlay and advances playback callbacks if preloading fails entirely', async () => {
    preloadTrack.mockRejectedValueOnce(new Error('Failed to preload any clip durations'));
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={onPlaybackStart}
        onPlaybackEnd={onPlaybackEnd}
        onExtendRequest={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('clip-error')).toBeInTheDocument());
    expect(screen.queryByTestId('tap-to-start')).not.toBeInTheDocument();
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
  });

  it('falls back to an iTunes preview and shows the attribution badge if the catalog clip fails to load', async () => {
    preloadTrack.mockRejectedValueOnce(new Error('Failed to preload any clip durations'));
    preloadTrack.mockResolvedValueOnce(undefined);
    fetchItunesPreview.mockResolvedValueOnce({
      previewUrl: 'https://audio.example/preview.m4a',
      trackViewUrl: 'https://music.apple.com/track/1',
    });
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

    await waitFor(() => expect(fetchItunesPreview).toHaveBeenCalledWith('Some Song', 'Some Artist'));
    await waitFor(() => expect(screen.getByTestId('itunes-fallback-badge')).toBeInTheDocument());
    expect(screen.getByTestId('itunes-fallback-badge')).toHaveAttribute('href', 'https://music.apple.com/track/1');
    expect(screen.queryByTestId('clip-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('tap-to-start')).not.toBeDisabled();
    expect(onPlaybackStart).not.toHaveBeenCalled();
    expect(onPlaybackEnd).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(preloadTrack).toHaveBeenLastCalledWith({
        '1s': 'https://audio.example/preview.m4a',
        '3s': 'https://audio.example/preview.m4a',
        '5s': 'https://audio.example/preview.m4a',
        '10s': 'https://audio.example/preview.m4a',
        '30s': 'https://audio.example/preview.m4a',
      }),
    );
  });

  it('shows the error overlay when both the catalog clip and the iTunes fallback fail', async () => {
    preloadTrack.mockRejectedValueOnce(new Error('Failed to preload any clip durations'));
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
    expect(screen.queryByTestId('itunes-fallback-badge')).not.toBeInTheDocument();
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
  });

  it('shows a Stop button while playing, and stopping ends playback early', async () => {
    let resolvePlay: (() => void) | undefined;
    play.mockImplementationOnce(() => new Promise<void>((resolve) => (resolvePlay = resolve)));
    const onPlaybackEnd = vi.fn();
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={vi.fn()}
        onPlaybackEnd={onPlaybackEnd}
        onExtendRequest={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('tap-to-start'));

    await waitFor(() => expect(screen.getByTestId('stop-button')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('stop-button'));

    expect(stop).toHaveBeenCalled();
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('stop-button')).not.toBeInTheDocument();

    // The still-pending play() promise resolving later must not double-fire onPlaybackEnd.
    resolvePlay?.();
    await Promise.resolve();
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
  });

  it('shows the live multiplier in the background while playing', async () => {
    let resolvePlay: (() => void) | undefined;
    play.mockImplementationOnce(() => new Promise<void>((resolve) => (resolvePlay = resolve)));
    render(
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        multiplier={1.7}
        onPlaybackStart={vi.fn()}
        onPlaybackEnd={vi.fn()}
        onExtendRequest={vi.fn()}
      />,
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
      <ClipPlayer
        clipUrls={clipUrls}
        currentDuration="1s"
        onPlaybackStart={vi.fn()}
        onPlaybackEnd={onPlaybackEnd}
        onExtendRequest={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('tap-to-start')).not.toBeDisabled());

    await userEvent.click(screen.getByTestId('tap-to-start'));

    await waitFor(() => expect(screen.getByTestId('clip-error')).toBeInTheDocument());
    expect(onPlaybackEnd).not.toHaveBeenCalled();
  });
});
