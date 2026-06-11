import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChallengeCreateScreen } from './create';
import { useCatalogStore } from '../store/catalogStore';
import { useGameStore } from '../store/gameStore';
import type { Track } from '../types/track';

const navigate = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,fake') },
}));

const buildTrack = (id: string, title: string): Track =>
  ({
    track_id: id,
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: title, aliases: [] },
      primary_artist: { value: 'Artist', aliases: [] },
      release_year: { value: 2000, tolerance: 2 },
      album_name: { value: 'Album', aliases: [] },
      songwriter: { value: ['Writer'], partial_credit: true },
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

describe('ChallengeCreateScreen', () => {
  beforeEach(() => {
    navigate.mockClear();
    useGameStore.getState().reset();
    useCatalogStore.setState({
      tracks: [buildTrack('t1', 'Track One'), buildTrack('t2', 'Track Two')],
      fuseIndex: null,
      fieldTries: {},
      isLoading: false,
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
  });

  it('disables Next on step 1 until a track is added', async () => {
    render(<ChallengeCreateScreen />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await userEvent.click(screen.getByTestId('add-t1'));
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
  });

  it('walks through all four steps and shows the publish screen', async () => {
    render(<ChallengeCreateScreen />);

    await userEvent.click(screen.getByTestId('add-t1'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Track One')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Challenge Name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Preview & Publish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Play My Challenge Now/ })).toBeInTheDocument();
  });

  it('loads the challenge into the game store and navigates on Play My Challenge Now', async () => {
    render(<ChallengeCreateScreen />);

    await userEvent.click(screen.getByTestId('add-t1'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(screen.getByRole('button', { name: /Play My Challenge Now/ }));

    expect(useGameStore.getState().challenge?.tracks).toEqual(['t1']);
    expect(navigate).toHaveBeenCalledWith({ to: '/game' });
  });

  it('expands inline track configuration from the track list', async () => {
    render(<ChallengeCreateScreen />);

    await userEvent.click(screen.getByTestId('add-t1'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(screen.getByTestId('param-genre')).toBeInTheDocument();
  });
});
