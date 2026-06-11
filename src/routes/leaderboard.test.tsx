import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaderboardScreen } from './leaderboard';
import { usePlayerStore } from '../store/playerStore';
import type { PlayerResult } from '../types/challenge';

const buildEntry = (overrides: Partial<PlayerResult> = {}): PlayerResult => ({
  playerId: 'player-1',
  playerName: 'Glen',
  score: 7710,
  durationSeconds: 120,
  clipExtensions: 0,
  ...overrides,
});

describe('LeaderboardScreen', () => {
  beforeEach(() => {
    usePlayerStore.setState({ player_id: 'player-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders ranked entries and highlights the current player', async () => {
    const entries = [buildEntry(), buildEntry({ playerId: 'player-2', playerName: 'Riley', score: 5000 })];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(entries), { status: 200 }))),
    );

    render(<LeaderboardScreen challengeId="XqZ9mK" />);

    await waitFor(() => expect(screen.getByText(/Glen \(you\)/)).toBeInTheDocument());
    expect(screen.getByText('7,710 pts')).toBeInTheDocument();
    expect(screen.getByText('Riley')).toBeInTheDocument();
    expect(screen.getByText('5,000 pts')).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))));

    render(<LeaderboardScreen challengeId="XqZ9mK" />);

    await waitFor(() => expect(screen.getByText(/No results yet/)).toBeInTheDocument());
  });

  it('shows an error state when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('not found', { status: 404 }))));

    render(<LeaderboardScreen challengeId="XqZ9mK" />);

    await waitFor(() => expect(screen.getByText('Leaderboard Unavailable')).toBeInTheDocument());
  });

  it('copies the leaderboard URL when sharing', async () => {
    const entries = [buildEntry()];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(entries), { status: 200 }))),
    );
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });

    render(<LeaderboardScreen challengeId="XqZ9mK" />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Share Leaderboard/ })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Share Leaderboard/ }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/leaderboard?c=XqZ9mK'));
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });
});
