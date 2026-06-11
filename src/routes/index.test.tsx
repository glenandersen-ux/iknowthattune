import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from './index';
import { useCatalogStore } from '../store/catalogStore';
import { usePlayerStore } from '../store/playerStore';
import type { Track } from '../types/track';

const navigate = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: () => navigate };
});

const buildTrack = (id: string, genre: string[], difficulty: number): Track =>
  ({
    track_id: id,
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: 'Title', aliases: [] },
      primary_artist: { value: 'Artist', aliases: [] },
      release_year: { value: 2000, tolerance: 2 },
      album_name: { value: 'Album', aliases: [] },
      songwriter: { value: [], partial_credit: true },
      producer: { value: null, aliases: [] },
      record_label: { value: null, aliases: [] },
      genre: { value: genre },
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
    metadata: { decade: 2000, language: 'en', tags: [], difficulty_score: difficulty },
  }) as Track;

describe('HomeScreen', () => {
  beforeEach(() => {
    navigate.mockClear();
    useCatalogStore.setState({
      tracks: [buildTrack('track-1', ['Rock'], 2.0), buildTrack('track-2', ['Pop'], 1.0)],
      isLoading: false,
    });
    usePlayerStore.setState({ daily_drop_streak: 0 });
  });

  it('shows the genre and difficulty badge for the daily track without revealing the title', async () => {
    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText("Today's Drop")).toBeInTheDocument());
    expect(screen.queryByText('Title')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Play Today's Drop" })).toBeInTheDocument();
  });

  it('navigates to the game with the daily mode and seed when played', async () => {
    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByRole('button', { name: "Play Today's Drop" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: "Play Today's Drop" }));

    expect(navigate).toHaveBeenCalledTimes(1);
    const call = navigate.mock.calls[0]?.[0] as { to: string; search: { mode: string; seed: string; date: string } };
    expect(call.to).toBe('/game');
    expect(call.search.mode).toBe('daily');
    expect(['track-1', 'track-2']).toContain(call.search.seed);
    expect(call.search.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows the daily streak banner when the player has an active streak', async () => {
    usePlayerStore.setState({ daily_drop_streak: 7 });
    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText(/7-day streak/)).toBeInTheDocument());
  });

  it('starts a Solo Sprint with a seed of track IDs matching the selected genre', async () => {
    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Rock' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Rock' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start Solo Sprint' }));

    expect(navigate).toHaveBeenCalledWith({ to: '/game', search: { mode: 'solo', seed: 'track-1' } });
  });
});
