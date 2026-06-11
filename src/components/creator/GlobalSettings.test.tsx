import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalSettings } from './GlobalSettings';
import type { ChallengeSettings } from '../../types/challenge';

const baseSettings: ChallengeSettings = {
  time_pressure: 'standard',
  hints: 'none',
  expiry_ms: null,
  leaderboard_public: true,
};

describe('GlobalSettings', () => {
  it('updates the challenge name and creator name', () => {
    const onChangeChallengeName = vi.fn();
    const onChangeCreatorName = vi.fn();
    render(
      <GlobalSettings
        challengeName=""
        onChangeChallengeName={onChangeChallengeName}
        creatorName=""
        onChangeCreatorName={onChangeCreatorName}
        settings={baseSettings}
        onChangeSettings={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Glen's 70s Soul Quiz"), { target: { value: 'My Quiz' } });
    expect(onChangeChallengeName).toHaveBeenCalledWith('My Quiz');

    fireEvent.change(screen.getByPlaceholderText('e.g. Glen'), { target: { value: 'Glen' } });
    expect(onChangeCreatorName).toHaveBeenCalledWith('Glen');
  });

  it('selects time pressure, hints, expiry, and leaderboard visibility', () => {
    const onChangeSettings = vi.fn();
    render(
      <GlobalSettings
        challengeName=""
        onChangeChallengeName={vi.fn()}
        creatorName=""
        onChangeCreatorName={vi.fn()}
        settings={baseSettings}
        onChangeSettings={onChangeSettings}
      />,
    );

    fireEvent.click(screen.getByTestId('time-pressure-blitz'));
    expect(onChangeSettings).toHaveBeenLastCalledWith({ ...baseSettings, time_pressure: 'blitz' });

    fireEvent.click(screen.getByTestId('hints-generous'));
    expect(onChangeSettings).toHaveBeenLastCalledWith({ ...baseSettings, hints: 'generous' });

    fireEvent.click(screen.getByTestId('expiry-24h'));
    expect(onChangeSettings).toHaveBeenLastCalledWith({ ...baseSettings, expiry_ms: 24 * 60 * 60 * 1000 });

    fireEvent.click(screen.getByTestId('leaderboard-private'));
    expect(onChangeSettings).toHaveBeenLastCalledWith({ ...baseSettings, leaderboard_public: false });
  });

  it('highlights the active option for each setting', () => {
    render(
      <GlobalSettings
        challengeName=""
        onChangeChallengeName={vi.fn()}
        creatorName=""
        onChangeCreatorName={vi.fn()}
        settings={{ time_pressure: 'chill', hints: 'category', expiry_ms: 48 * 60 * 60 * 1000, leaderboard_public: false }}
        onChangeSettings={vi.fn()}
      />,
    );

    expect(screen.getByTestId('time-pressure-chill')).toHaveClass('bg-cyan-600');
    expect(screen.getByTestId('hints-category')).toHaveClass('bg-cyan-600');
    expect(screen.getByTestId('expiry-48h')).toHaveClass('bg-cyan-600');
    expect(screen.getByTestId('leaderboard-private')).toHaveClass('bg-cyan-600');
  });
});
