import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuessPanel } from './GuessPanel';
import type { Track } from '../../types/track';

const track: Track = {
  track_id: 'tk_test',
  clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
  clip_start_offset_ms: 0,
  answers: {
    song_title: { value: 'Bohemian Rhapsody', aliases: [] },
    primary_artist: { value: 'Queen', aliases: [] },
    release_year: { value: 1975, tolerance: 2 },
    album_name: { value: 'A Night at the Opera', aliases: [] },
    songwriter: { value: ['Freddie Mercury'], partial_credit: true },
    producer: { value: 'Roy Thomas Baker', aliases: [] },
    record_label: { value: 'EMI', aliases: [] },
    genre: { value: ['Rock'] },
    band_members: { value: ['Freddie Mercury', 'Brian May', 'Roger Taylor', 'John Deacon'], partial_credit: true },
    featured_artist: { value: null },
    bpm: { value: 72, tolerance: 5 },
    key_signature: { value: 'B♭ major' },
    chart_peak: { value: 9, tolerance: 2 },
    sample_source: { value: null },
    certified_copies: { value: 'Platinum' },
    music_video_director: { value: 'Bruce Gowers' },
    opening_lyric: { value: 'Is this the real life', fuzzy_tolerance: 2 },
    instrument_solo: { value: ['Guitar'] },
    covered_by: { value: ['Panic! at the Disco'], partial_credit: true },
    soundtrack: { value: "Wayne's World" },
  },
  metadata: { decade: 1970, language: 'en', tags: [], difficulty_score: 2.3 },
};

describe('GuessPanel', () => {
  it('renders a field input for each active field', () => {
    render(
      <GuessPanel
        track={track}
        activeFields={['song_title', 'primary_artist']}
        fieldTries={{}}
        onSubmit={vi.fn()}
        onGiveUp={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Song Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Primary Artist')).toBeInTheDocument();
  });

  it('submits results and locks correct fields, leaving incorrect fields editable', () => {
    const onSubmit = vi.fn();
    render(
      <GuessPanel
        track={track}
        activeFields={['song_title', 'primary_artist']}
        fieldTries={{}}
        onSubmit={onSubmit}
        onGiveUp={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Song Title'), { target: { value: 'Bohemian Rhapsody' } });
    fireEvent.change(screen.getByLabelText('Primary Artist'), { target: { value: 'Pink Floyd' } });
    fireEvent.click(screen.getByText('Submit Guess'));

    expect(onSubmit).toHaveBeenCalledWith(
      {
        song_title: { correct: true, partial: 0 },
        primary_artist: { correct: false, partial: 0 },
      },
      [
        { fieldId: 'song_title', value: 'Bohemian Rhapsody' },
        { fieldId: 'primary_artist', value: 'Pink Floyd' },
      ],
    );

    expect(screen.getByTestId('field-song_title-locked')).toBeInTheDocument();
    expect(screen.getByLabelText('Primary Artist')).toBeInTheDocument();
  });

  it('shows autocomplete suggestions by default but suppresses them in expert assist mode', async () => {
    const fieldTries = { song_title: ['Bohemian Rhapsody', 'Bohemian Like You'] };

    const { rerender } = render(
      <GuessPanel
        track={track}
        activeFields={['song_title']}
        fieldTries={fieldTries}
        onSubmit={vi.fn()}
        onGiveUp={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Song Title'), { target: { value: 'Bohem' } });
    await waitFor(() => expect(screen.getByTestId('field-song_title-suggestions')).toBeInTheDocument());

    rerender(
      <GuessPanel
        track={track}
        activeFields={['song_title']}
        fieldTries={fieldTries}
        assistMode="expert"
        onSubmit={vi.fn()}
        onGiveUp={vi.fn()}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.queryByTestId('field-song_title-suggestions')).not.toBeInTheDocument();
  });

  it('calls onGiveUp when the Give Up button is pressed', () => {
    const onGiveUp = vi.fn();
    render(
      <GuessPanel
        track={track}
        activeFields={['song_title']}
        fieldTries={{}}
        onSubmit={vi.fn()}
        onGiveUp={onGiveUp}
      />,
    );
    fireEvent.click(screen.getByText('Give Up'));
    expect(onGiveUp).toHaveBeenCalledOnce();
  });
});
