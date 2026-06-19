import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameScreen } from './game';
import { useGameStore } from '../store/gameStore';
import { useCatalogStore } from '../store/catalogStore';
import { usePlayerStore } from '../store/playerStore';
import { encodeResult, encodeSeed } from '../engine/UrlCodec';
import { DEFAULT_CHALLENGE_SCORING } from '../engine/ChallengeBuilder';
import type { Challenge } from '../types/challenge';
import type { Track } from '../types/track';

const navigate = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../components/game/ClipPlayer', () => ({
  ClipPlayer: ({
    onPlaybackStart,
    onPlaybackEnd,
  }: {
    onPlaybackStart: () => void;
    onPlaybackEnd: () => void;
  }) => (
    <div data-testid="clip-player-stub">
      <button type="button" onClick={onPlaybackStart}>
        start clip
      </button>
      <button type="button" onClick={onPlaybackEnd}>
        end clip
      </button>
    </div>
  ),
}));

const buildTrack = (id: string, title: string): Track => ({
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
});

async function submitCorrectGuesses(title: string): Promise<void> {
  await userEvent.type(screen.getByLabelText('Song Title'), title);
  await userEvent.type(screen.getByLabelText('Primary Artist'), 'Test Artist');
  await userEvent.type(screen.getByLabelText(/Release Year/), '2000');
  await userEvent.type(screen.getByLabelText('Album Name'), 'Test Album');
  await userEvent.click(screen.getByRole('button', { name: 'Submit Guess' }));
}

describe('GameScreen', () => {
  beforeEach(() => {
    navigate.mockClear();
    useGameStore.getState().reset();
    useCatalogStore.setState({
      tracks: [buildTrack('track-1', 'Track One'), buildTrack('track-2', 'Track Two')],
      fieldTries: {},
      isLoading: false,
    });
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
  });

  it('plays through a 2-track game and reaches the result screen', async () => {
    render(<GameScreen search={{ seed: encodeSeed('track-1,track-2') }} />);

    // Track 1: idle -> playing -> guessing -> reveal
    await waitFor(() => expect(screen.getByText('Track 1 of 2')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'start clip' }));
    expect(useGameStore.getState().phase).toBe('playing');

    await userEvent.click(screen.getByRole('button', { name: 'end clip' }));
    expect(useGameStore.getState().phase).toBe('guessing');

    await submitCorrectGuesses('Track One');
    expect(useGameStore.getState().phase).toBe('reveal');
    expect(screen.getByTestId('continue-button')).toHaveTextContent('Next Track');

    await userEvent.click(screen.getByTestId('continue-button'));

    // Track 2: idle -> playing -> guessing -> reveal -> complete
    await waitFor(() => expect(screen.getByText('Track 2 of 2')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'start clip' }));
    await userEvent.click(screen.getByRole('button', { name: 'end clip' }));
    await submitCorrectGuesses('Track Two');
    expect(screen.getByTestId('continue-button')).toHaveTextContent('See Results');

    await userEvent.click(screen.getByTestId('continue-button'));

    await waitFor(() => expect(useGameStore.getState().phase).toBe('complete'));
    expect(navigate).toHaveBeenCalledWith({ to: '/result' });
    expect(usePlayerStore.getState().games_played).toBe(1);

    const totals = useGameStore.getState().session.totals;
    expect(totals.tracks_perfect).toBe(2);
    expect(totals.total_score).toBeGreaterThan(0);
  });

  it('reveals the canonical answer and scores zero when the player gives up', async () => {
    render(<GameScreen search={{ seed: encodeSeed('track-1,track-2') }} />);

    await waitFor(() => expect(screen.getByText('Track 1 of 2')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'start clip' }));
    await userEvent.click(screen.getByRole('button', { name: 'Give Up' }));

    expect(useGameStore.getState().phase).toBe('reveal');
    expect(screen.getByText(/Track One/)).toBeInTheDocument();
    const lastTrack = useGameStore.getState().session.tracks[0];
    expect(lastTrack.gave_up).toBe(true);
    expect(lastTrack.raw_score).toBe(0);
  });

  it('offers a micro-challenge link after a correct guess and copies it to the clipboard', async () => {
    render(<GameScreen search={{ seed: encodeSeed('track-1,track-2') }} />);

    await waitFor(() => expect(screen.getByText('Track 1 of 2')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'start clip' }));
    await userEvent.click(screen.getByRole('button', { name: 'end clip' }));
    await submitCorrectGuesses('Track One');

    const challengeButton = screen.getByRole('button', { name: /Challenge a friend/ });
    await userEvent.click(challengeButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(`mode=micro&t=${encodeSeed('track-1')}&p=song_title,primary_artist,release_year,album_name&r=`),
    );
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it('loads a single-track micro-challenge from the URL and computes a win/loss comparison', async () => {
    const r = encodeResult({ u: 'Glen', s: 1, g: [1], t: 30, p: 4 });
    render(
      <GameScreen
        search={{ mode: 'micro', t: encodeSeed('track-1'), p: 'song_title,primary_artist,release_year,album_name', r }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Track 1 of 1')).toBeInTheDocument());
    expect(useGameStore.getState().challenge?.id).toBe('micro');

    await userEvent.click(screen.getByRole('button', { name: 'start clip' }));
    await userEvent.click(screen.getByRole('button', { name: 'end clip' }));
    await submitCorrectGuesses('Track One');
    expect(screen.getByTestId('continue-button')).toHaveTextContent('See Results');

    await userEvent.click(screen.getByTestId('continue-button'));

    await waitFor(() => expect(useGameStore.getState().phase).toBe('complete'));
    const comparison = useGameStore.getState().session.comparison;
    expect(comparison?.challenger_name).toBe('Glen');
    expect(comparison?.challenger_score).toBe(1);
    expect(comparison?.result).toBe('win');
  });

  it('computes a "Beat My Score" comparison against the challenge creator for an accepted multi-track challenge', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))));

    const challenge: Challenge = {
      id: 'XqZ9mK',
      version: 1,
      created_at: Date.now(),
      creator_name: 'Glen',
      creator_player_id: 'creator-1',
      creator_score: 4000,
      name: 'Glen’s Challenge',
      tracks: ['track-1'],
      active_params: { 'track-1': ['song_title', 'primary_artist', 'release_year', 'album_name'] },
      clip_starts: { 'track-1': 'hook' },
      settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
      scoring: DEFAULT_CHALLENGE_SCORING,
    };
    useGameStore.getState().loadChallenge(challenge, 'challenge', 'Friend');

    render(<GameScreen search={{}} />);

    await waitFor(() => expect(screen.getByText('Track 1 of 1')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'start clip' }));
    await userEvent.click(screen.getByRole('button', { name: 'end clip' }));
    await submitCorrectGuesses('Track One');
    await userEvent.click(screen.getByTestId('continue-button'));

    await waitFor(() => expect(useGameStore.getState().phase).toBe('complete'));
    const comparison = useGameStore.getState().session.comparison;
    expect(comparison?.challenger_name).toBe('Glen');
    expect(comparison?.challenger_score).toBe(4000);
    expect(comparison?.result).toBe('win');

    vi.unstubAllGlobals();
  });

  it('loads a new Solo Sprint seed even if a previous game challenge is still in the store', async () => {
    // Simulate a previously-played game (e.g. Daily Drop) leaving its challenge in the global store.
    const { buildSoloChallenge } = await import('../engine/ChallengeBuilder');
    useGameStore.getState().loadChallenge(buildSoloChallenge([buildTrack('track-1', 'Track One')], 'daily', 'p1'), 'daily', 'Player');

    const { rerender } = render(<GameScreen search={{ mode: 'solo', seed: encodeSeed('track-2') }} />);

    await waitFor(() => expect(useGameStore.getState().challenge?.tracks).toEqual(['track-2']));
    expect(screen.getByText(/Track 1 of 1/)).toBeInTheDocument();

    rerender(<GameScreen search={{ mode: 'solo', seed: encodeSeed('track-2') }} />);
    expect(useGameStore.getState().challenge?.tracks).toEqual(['track-2']);
  });
});
