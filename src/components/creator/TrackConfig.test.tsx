import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrackConfig } from './TrackConfig';
import type { Track } from '../../types/track';

const buildTrack = (): Track =>
  ({
    track_id: 't1',
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: 'Track One', aliases: [] },
      primary_artist: { value: 'Artist A', aliases: [] },
      release_year: { value: 2000, tolerance: 2 },
      album_name: { value: 'Album', aliases: [] },
      songwriter: { value: ['Writer A'], partial_credit: true },
      producer: { value: null, aliases: [] },
      record_label: { value: 'Label', aliases: [] },
      genre: { value: ['Rock'] },
      band_members: { value: [], partial_credit: true },
      featured_artist: { value: null },
      bpm: { value: null, tolerance: 5 },
      key_signature: { value: null },
      chart_peak: { value: null, tolerance: 2 },
      sample_source: { value: null },
      certified_copies: { value: null },
      music_video_director: { value: null },
      opening_lyric: { value: null, fuzzy_tolerance: 2 },
      instrument_solo: { value: null },
      covered_by: { value: [], partial_credit: true },
      soundtrack: { value: null },
    },
    metadata: { decade: 2000, language: 'en', tags: [], difficulty_score: 1 },
  }) as Track;

describe('TrackConfig', () => {
  it('disables and labels fields with no data as not available', () => {
    render(
      <TrackConfig
        track={buildTrack()}
        activeFields={['song_title', 'primary_artist', 'release_year', 'album_name']}
        onChangeFields={vi.fn()}
        clipStart="hook"
        onChangeClipStart={vi.fn()}
      />,
    );

    const producer = screen.getByTestId('param-producer');
    expect(producer).toBeDisabled();
    expect(producer).toHaveTextContent('⚠ not available');
  });

  it('toggles a field on click and reports the new field list', () => {
    const onChangeFields = vi.fn();
    render(
      <TrackConfig
        track={buildTrack()}
        activeFields={['song_title', 'primary_artist', 'release_year', 'album_name']}
        onChangeFields={onChangeFields}
        clipStart="hook"
        onChangeClipStart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('param-genre'));
    expect(onChangeFields).toHaveBeenCalledWith(['song_title', 'primary_artist', 'release_year', 'album_name', 'genre']);

    fireEvent.click(screen.getByTestId('param-song_title'));
    expect(onChangeFields).toHaveBeenCalledWith(['primary_artist', 'release_year', 'album_name']);
  });

  it('applies the Easy preset', () => {
    const onChangeFields = vi.fn();
    render(
      <TrackConfig track={buildTrack()} activeFields={[]} onChangeFields={onChangeFields} clipStart="hook" onChangeClipStart={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId('preset-Easy'));
    expect(onChangeFields).toHaveBeenCalledWith(['song_title', 'primary_artist', 'release_year']);
  });

  it('applies the Sadistic preset using only available fields', () => {
    const onChangeFields = vi.fn();
    render(
      <TrackConfig track={buildTrack()} activeFields={[]} onChangeFields={onChangeFields} clipStart="hook" onChangeClipStart={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId('preset-Sadistic'));
    const fields = onChangeFields.mock.calls[0][0] as string[];
    expect(fields).toContain('song_title');
    expect(fields).toContain('songwriter');
    expect(fields).not.toContain('producer');
  });

  it('selects a clip start option', () => {
    const onChangeClipStart = vi.fn();
    render(
      <TrackConfig track={buildTrack()} activeFields={[]} onChangeFields={vi.fn()} clipStart="hook" onChangeClipStart={onChangeClipStart} />,
    );

    fireEvent.click(screen.getByTestId('clip-start-intro'));
    expect(onChangeClipStart).toHaveBeenCalledWith('intro');
  });

  it('shows a max score that updates with active fields', () => {
    const { rerender } = render(
      <TrackConfig track={buildTrack()} activeFields={['song_title']} onChangeFields={vi.fn()} clipStart="hook" onChangeClipStart={vi.fn()} />,
    );
    const initial = screen.getByText(/Max score:/).textContent;

    rerender(
      <TrackConfig
        track={buildTrack()}
        activeFields={['song_title', 'primary_artist', 'release_year', 'album_name']}
        onChangeFields={vi.fn()}
        clipStart="hook"
        onChangeClipStart={vi.fn()}
      />,
    );
    const updated = screen.getByText(/Max score:/).textContent;

    expect(initial).not.toEqual(updated);
  });
});
