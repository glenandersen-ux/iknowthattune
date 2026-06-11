import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChallengeLandingScreen } from './challenge.$id';
import { useCatalogStore } from '../store/catalogStore';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { encodeMiniChallenge } from '../engine/UrlCodec';
import type { Challenge } from '../types/challenge';
import type { Track } from '../types/track';

const navigate = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: () => navigate };
});

const buildTrack = (id: string, title: string, difficulty: number): Track =>
  ({
    track_id: id,
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: title, aliases: [] },
      primary_artist: { value: 'Artist', aliases: [] },
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
    metadata: { decade: 2000, language: 'en', tags: [], difficulty_score: difficulty },
  }) as Track;

const buildChallenge = (overrides: Partial<Challenge> = {}): Challenge => ({
  id: 'XqZ9mK',
  version: 1,
  created_at: Date.now(),
  creator_name: 'Glen',
  creator_player_id: 'player-1',
  creator_score: 7710,
  name: "Glen's 70s Soul Quiz",
  tracks: ['t1'],
  active_params: { t1: ['song_title', 'primary_artist', 'release_year'] },
  clip_starts: { t1: 'hook' },
  settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
  scoring: { first_guess_bonus: 500, clip_penalties: [100, 250, 450, 750], streak_multipliers: [0.1, 0.2, 0.35, 0.5] },
  ...overrides,
});

describe('ChallengeLandingScreen', () => {
  beforeEach(() => {
    navigate.mockClear();
    useGameStore.getState().reset();
    useCatalogStore.setState({ tracks: [buildTrack('t1', 'Track One', 2.0)], fuseIndex: null, fieldTries: {}, isLoading: false });
    usePlayerStore.setState({ display_name: 'Friend' });
  });

  it('decodes a mini-challenge from the URL and renders its details', async () => {
    const challenge = buildChallenge();
    const mini = encodeMiniChallenge(challenge);

    render(<ChallengeLandingScreen id={challenge.id} mini={mini} />);

    await waitFor(() => expect(screen.getByText("Glen's 70s Soul Quiz")).toBeInTheDocument());
    expect(screen.getByText('Created by Glen')).toBeInTheDocument();
    expect(screen.getByText('7,710 pts')).toBeInTheDocument();
    expect(screen.getByText('1 track')).toBeInTheDocument();
    expect(screen.getByTestId('difficulty-badge')).toHaveTextContent('Medium');
  });

  it('shows an error for a malformed mini-challenge', async () => {
    render(<ChallengeLandingScreen id="abc123" mini="not-valid-base64!!!" />);
    await waitFor(() => expect(screen.getByText('Challenge Not Found')).toBeInTheDocument());
  });

  it('shows an error when fetching a KV challenge fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('not found', { status: 404 }))));
    render(<ChallengeLandingScreen id="abc123" />);
    await waitFor(() => expect(screen.getByText('Challenge Not Found')).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it('accepts the challenge, loading it into the game store and navigating to /game', async () => {
    const challenge = buildChallenge();
    const mini = encodeMiniChallenge(challenge);

    render(<ChallengeLandingScreen id={challenge.id} mini={mini} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept Challenge' })).toBeInTheDocument());

    const nicknameInput = screen.getByPlaceholderText('Enter a nickname');
    await userEvent.clear(nicknameInput);
    await userEvent.type(nicknameInput, 'Riley');

    await userEvent.click(screen.getByRole('button', { name: 'Accept Challenge' }));

    expect(useGameStore.getState().challenge?.id).toBe('XqZ9mK');
    expect(useGameStore.getState().session.player_name).toBe('Riley');
    expect(useGameStore.getState().session.mode).toBe('challenge');
    expect(usePlayerStore.getState().display_name).toBe('Riley');
    expect(navigate).toHaveBeenCalledWith({ to: '/game' });
  });
});
