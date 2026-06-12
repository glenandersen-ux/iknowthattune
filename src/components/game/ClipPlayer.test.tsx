import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClipPlayer } from './ClipPlayer';

const preloadTrack = vi.fn().mockResolvedValue(undefined);
const unlock = vi.fn().mockResolvedValue(undefined);
const play = vi.fn().mockResolvedValue(undefined);
const getWaveformData = vi.fn(() => new Uint8Array(8));

vi.mock('../../engine/AudioEngine', () => ({
  AudioEngine: vi.fn().mockImplementation(function MockAudioEngine() {
    return {
      preloadTrack,
      unlock,
      play,
      getWaveformData,
      stop: vi.fn(),
    };
  }),
}));

const clipUrls = { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' };

describe('ClipPlayer', () => {
  beforeEach(() => {
    preloadTrack.mockClear();
    unlock.mockClear();
    play.mockClear();
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
    expect(play).toHaveBeenCalledWith('1s');
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
