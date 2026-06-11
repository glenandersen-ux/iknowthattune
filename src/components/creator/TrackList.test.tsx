import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrackList } from './TrackList';
import type { FieldId, Track } from '../../types/track';

const buildTrack = (id: string, title: string, artist: string): Track =>
  ({
    track_id: id,
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: title, aliases: [] },
      primary_artist: { value: artist, aliases: [] },
      release_year: { value: 2000, tolerance: 2 },
      album_name: { value: 'Album', aliases: [] },
      songwriter: { value: [], partial_credit: true },
      producer: { value: null, aliases: [] },
      record_label: { value: null, aliases: [] },
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

const tracks = [buildTrack('t1', 'Track One', 'Artist A'), buildTrack('t2', 'Track Two', 'Artist B')];

const activeParams: Record<string, FieldId[]> = {
  t1: ['song_title', 'primary_artist', 'release_year', 'album_name'],
  t2: [],
};

describe('TrackList', () => {
  it('renders each track with its title, artist, and param dots', () => {
    render(<TrackList tracks={tracks} activeParams={activeParams} onReorder={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Track One')).toBeInTheDocument();
    expect(screen.getByText('Track Two')).toBeInTheDocument();
    expect(screen.getByTestId('param-dots-t1')).toHaveTextContent('●○○○');
    expect(screen.getByTestId('param-dots-t2')).toHaveTextContent('○○○○');
  });

  it('shows the track count and estimated time', () => {
    render(<TrackList tracks={tracks} activeParams={activeParams} onReorder={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('2 tracks · ~3m')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<TrackList tracks={tracks} activeParams={activeParams} onReorder={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Remove Track One'));
    expect(onRemove).toHaveBeenCalledWith('t1');
  });

  it('toggles the inline configure panel via renderConfig', () => {
    render(
      <TrackList
        tracks={tracks}
        activeParams={activeParams}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        renderConfig={(track) => <div>Config for {track.track_id}</div>}
      />,
    );

    expect(screen.queryByText('Config for t1')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText(/Configure/)[0]);
    expect(screen.getByText('Config for t1')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText(/Configure/)[0]);
    expect(screen.queryByText('Config for t1')).not.toBeInTheDocument();
  });

  it('reorders tracks via drag and drop', () => {
    const onReorder = vi.fn();
    render(<TrackList tracks={tracks} activeParams={activeParams} onReorder={onReorder} onRemove={vi.fn()} />);

    const source = screen.getByTestId('track-row-t1');
    const target = screen.getByTestId('track-row-t2');

    fireEvent.dragStart(source, { dataTransfer: { effectAllowed: '', dropEffect: '' } });
    fireEvent.dragOver(target, { dataTransfer: { effectAllowed: '', dropEffect: '' } });
    fireEvent.drop(target, { dataTransfer: { effectAllowed: '', dropEffect: '' } });

    expect(onReorder).toHaveBeenCalledWith([tracks[1], tracks[0]]);
  });
});
