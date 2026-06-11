import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileScreen } from './profile';
import { usePlayerStore } from '../store/playerStore';

describe('ProfileScreen', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      display_name: 'Glen',
      games_played: 12,
      accuracy_all_time_pct: 75,
      best_score_ever: 8200,
      daily_drop_streak: 3,
      badges: ['first_blood'],
      hardest_field_accuracy: { sample_source: 0.2 },
      easiest_field_accuracy: { song_title: 0.9 },
    });
  });

  it('shows lifetime stats, streak, and badges', () => {
    render(<ProfileScreen />);

    expect(screen.getByText(/Glen/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('8,200')).toBeInTheDocument();
    expect(screen.getByText(/3-day streak/)).toBeInTheDocument();
    expect(screen.getByText('First Blood')).toBeInTheDocument();
  });

  it('shows hardest and easiest field accuracy', () => {
    render(<ProfileScreen />);

    expect(screen.getByText('Sample Source')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('Song Title')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('allows editing the display name', async () => {
    render(<ProfileScreen />);

    await userEvent.click(screen.getByRole('button', { name: /Glen/ }));
    const input = screen.getByDisplayValue('Glen');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Name{Enter}');

    expect(usePlayerStore.getState().display_name).toBe('New Name');
  });
});
