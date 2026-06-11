import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogSearch } from './CatalogSearch';
import { useCatalogStore } from '../../store/catalogStore';
import type { Track } from '../../types/track';

const buildTrack = (id: string, title: string, artist: string, genre: string, decade: number): Track =>
  ({
    track_id: id,
    clip_urls: { '1s': 'a', '3s': 'b', '5s': `${id}-5s.mp3`, '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: title, aliases: [] },
      primary_artist: { value: artist, aliases: [] },
      release_year: { value: decade + 1, tolerance: 2 },
      album_name: { value: 'Album', aliases: [] },
      songwriter: { value: [], partial_credit: true },
      producer: { value: null, aliases: [] },
      record_label: { value: null, aliases: [] },
      genre: { value: [genre] },
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
    metadata: { decade, language: 'en', tags: [], difficulty_score: 1 },
  }) as Track;

const tracks = [
  buildTrack('t1', 'Billie Jean', 'Michael Jackson', 'Pop', 1980),
  buildTrack('t2', 'Smells Like Teen Spirit', 'Nirvana', 'Rock', 1990),
];

describe('CatalogSearch', () => {
  beforeEach(() => {
    useCatalogStore.setState({ tracks, fuseIndex: null, fieldTries: {}, isLoading: false });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('renders track results from the catalog', () => {
    render(<CatalogSearch selectedTrackIds={[]} onToggleTrack={vi.fn()} />);
    expect(screen.getByText('Billie Jean')).toBeInTheDocument();
    expect(screen.getByText('Smells Like Teen Spirit')).toBeInTheDocument();
    expect(screen.getByText('0/10 tracks')).toBeInTheDocument();
  });

  it('filters results by genre chip', () => {
    render(<CatalogSearch selectedTrackIds={[]} onToggleTrack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-genre-Rock'));
    expect(screen.getByText('Smells Like Teen Spirit')).toBeInTheDocument();
    expect(screen.queryByText('Billie Jean')).not.toBeInTheDocument();
  });

  it('calls onToggleTrack and reflects selection state', () => {
    const onToggleTrack = vi.fn();
    const { rerender } = render(<CatalogSearch selectedTrackIds={[]} onToggleTrack={onToggleTrack} />);

    fireEvent.click(screen.getByTestId('add-t1'));
    expect(onToggleTrack).toHaveBeenCalledWith(expect.objectContaining({ track_id: 't1' }));

    rerender(<CatalogSearch selectedTrackIds={['t1']} onToggleTrack={onToggleTrack} />);
    expect(screen.getByTestId('add-t1')).toHaveTextContent('✓ Added');
    expect(screen.getByText('1/10 tracks')).toBeInTheDocument();
  });

  it('disables adding new tracks once maxTracks is reached', () => {
    render(<CatalogSearch selectedTrackIds={['t1']} onToggleTrack={vi.fn()} maxTracks={1} />);
    expect(screen.getByTestId('add-t1')).not.toBeDisabled();
    expect(screen.getByTestId('add-t2')).toBeDisabled();
  });

  it('toggles clip preview playback on the preview button', () => {
    render(<CatalogSearch selectedTrackIds={[]} onToggleTrack={vi.fn()} />);
    const previewButton = screen.getByTestId('preview-t1');

    fireEvent.click(previewButton);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(previewButton).toHaveTextContent('⏸');

    fireEvent.click(previewButton);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(previewButton).toHaveTextContent('▶');
  });
});
