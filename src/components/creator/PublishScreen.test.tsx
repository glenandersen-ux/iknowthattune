import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishScreen, buildShareText } from './PublishScreen';
import type { Challenge } from '../../types/challenge';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,fake') },
}));

const buildChallenge = (trackCount: number, creatorScore: number | null = null): Challenge => ({
  id: 'placeholder',
  version: 1,
  created_at: Date.now(),
  creator_name: 'Glen',
  creator_player_id: 'player-1',
  creator_score: creatorScore,
  name: "Glen's Quiz",
  tracks: Array.from({ length: trackCount }, (_, i) => `track-${i}`),
  active_params: { 'track-0': ['song_title', 'primary_artist', 'release_year'] },
  clip_starts: { 'track-0': 'hook' },
  settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
  scoring: { first_guess_bonus: 500, clip_penalties: [100, 250, 450, 750], streak_multipliers: [0.1, 0.2, 0.35, 0.5] },
});

describe('PublishScreen', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
  });

  it('shows "Play My Challenge Now" only before the creator has played', () => {
    const { rerender } = render(<PublishScreen challenge={buildChallenge(2)} hasPlayed={false} onPlayNow={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Play My Challenge Now/ })).toBeInTheDocument();

    rerender(<PublishScreen challenge={buildChallenge(2)} hasPlayed={true} onPlayNow={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Play My Challenge Now/ })).not.toBeInTheDocument();
  });

  it('publishes a <=2-track challenge as a URL-embedded mini-challenge without calling fetch', async () => {
    render(<PublishScreen challenge={buildChallenge(2)} hasPlayed={true} onPlayNow={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Publish Challenge/ }));

    await waitFor(() => expect(screen.getByDisplayValue(/\/\?mini=/)).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByAltText('Challenge QR code')).toBeInTheDocument();
  });

  it('publishes a >2-track challenge via the API and links to a /?c= URL', async () => {
    render(<PublishScreen challenge={buildChallenge(3)} hasPlayed={true} onPlayNow={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Publish Challenge/ }));

    await waitFor(() => expect(screen.getByDisplayValue(/\/\?c=/)).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/challenge', expect.objectContaining({ method: 'POST' }));
  });

  it('copies the share link to the clipboard', async () => {
    render(<PublishScreen challenge={buildChallenge(2)} hasPlayed={true} onPlayNow={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Publish Challenge/ }));
    await waitFor(() => expect(screen.getByDisplayValue(/\/\?mini=/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });
});

describe('buildShareText', () => {
  it('includes the creator score when available', () => {
    const text = buildShareText(buildChallenge(2, 7710), 'https://example.com/?c=abc123');
    expect(text).toContain('7,710 pts');
    expect(text).toContain('https://example.com/?c=abc123');
  });

  it('falls back to a generic invite when there is no creator score', () => {
    const text = buildShareText(buildChallenge(2, null), 'https://example.com/?c=abc123');
    expect(text).toContain('I made a music trivia challenge');
  });
});
