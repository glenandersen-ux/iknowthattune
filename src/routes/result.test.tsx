import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultScreen } from './result';
import { useGameStore } from '../store/gameStore';
import { useCatalogStore } from '../store/catalogStore';
import type { Challenge } from '../types/challenge';
import type { Track } from '../types/track';
import type { TrackSession } from '../types/session';

const toDataURL = vi.fn(() => 'data:image/png;base64,fake');

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({ toDataURL })),
}));

const buildTrack = (id: string, title: string): Track =>
  ({
    track_id: id,
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: title, aliases: [] },
      primary_artist: { value: 'Test Artist', aliases: [] },
      release_year: { value: 2000, tolerance: 2 },
      album_name: { value: 'Test Album', aliases: [] },
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

const mockChallenge: Challenge = {
  id: 'solo-sprint',
  version: 1,
  created_at: Date.now(),
  creator_name: 'Player',
  creator_player_id: 'player-1',
  creator_score: null,
  name: 'Solo Sprint',
  tracks: ['track-1'],
  active_params: {
    'track-1': ['song_title', 'primary_artist', 'release_year', 'album_name'],
  },
  clip_starts: { 'track-1': 'hook' },
  settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
  scoring: { first_guess_bonus: 500, clip_penalties: [100, 250, 450, 750], streak_multipliers: [0.1, 0.2, 0.35, 0.5] },
};

const buildTrackSession = (overrides: Partial<TrackSession> = {}): TrackSession => ({
  track_id: 'track-1',
  play_order: 1,
  clip_sequence_used: ['1s'],
  time_to_first_submit_ms: 1000,
  total_time_on_track_ms: 1000,
  submit_count: 1,
  fields_attempted: ['song_title', 'primary_artist', 'release_year', 'album_name'],
  fields_correct: ['song_title', 'primary_artist', 'release_year', 'album_name'],
  fields_incorrect: [],
  fields_skipped: [],
  first_guess_bonus_earned: true,
  streak_position: 0,
  raw_score: 5180,
  clip_penalty_applied: 0,
  speed_multiplier_applied: 2,
  guess_history: [],
  ...overrides,
});

describe('ResultScreen', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    useCatalogStore.setState({ tracks: [buildTrack('track-1', 'Track One')], isLoading: false });
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    toDataURL.mockClear();
  });

  it('shows a fallback message when no game has been played', () => {
    render(<ResultScreen />);
    expect(screen.getByText('No results yet')).toBeInTheDocument();
  });

  it('renders the score breakdown table with the track title and total', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.setState((state) => ({
      session: {
        ...state.session,
        tracks: [buildTrackSession()],
        totals: { ...state.session.totals, total_score: 5180 },
      },
    }));

    render(<ResultScreen />);

    expect(screen.getByText('Track One')).toBeInTheDocument();
    expect(screen.getAllByText('5,180').length).toBeGreaterThan(0);
    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('copies the emoji grid to the clipboard', async () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.setState((state) => ({
      session: {
        ...state.session,
        tracks: [buildTrackSession()],
        totals: { ...state.session.totals, total_score: 5180 },
      },
    }));

    render(<ResultScreen />);
    await userEvent.click(screen.getByRole('button', { name: /Copy Emoji Grid/ }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('✅✅✅✅'));
  });

  it('shows a View Leaderboard link for server-backed challenges but not client-only ones', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.setState((state) => ({
      session: {
        ...state.session,
        tracks: [buildTrackSession()],
        totals: { ...state.session.totals, total_score: 5180 },
      },
    }));

    const { rerender } = render(<ResultScreen />);
    expect(screen.queryByRole('link', { name: /View Leaderboard/ })).not.toBeInTheDocument();

    useGameStore.setState((state) => ({
      challenge: state.challenge ? { ...state.challenge, id: 'XqZ9mK' } : state.challenge,
    }));
    rerender(<ResultScreen />);

    const link = screen.getByRole('link', { name: /View Leaderboard/ });
    expect(link).toHaveAttribute('href', '/leaderboard?c=XqZ9mK');
  });

  it('downloads the share card as a PNG via html2canvas', async () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.setState((state) => ({
      session: {
        ...state.session,
        tracks: [buildTrackSession()],
        totals: { ...state.session.totals, total_score: 5180 },
      },
    }));

    render(<ResultScreen />);
    await userEvent.click(screen.getByRole('button', { name: /Download Card/ }));

    await waitFor(() => expect(toDataURL).toHaveBeenCalledWith('image/png'));
  });
});
