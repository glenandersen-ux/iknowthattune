import { describe, it, expect, vi, afterEach } from 'vitest';
import { trackEvent } from './Analytics';

describe('trackEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.plausible;
  });

  it('does nothing when window.plausible is not defined', () => {
    expect(() => trackEvent('game_started', { mode: 'solo', challengeId: 'solo-sprint' })).not.toThrow();
  });

  it('forwards the event name and props to window.plausible when present', () => {
    const plausible = vi.fn();
    window.plausible = plausible;

    trackEvent('clip_extended', { from: '1s', to: '3s', trackIndex: 2 });

    expect(plausible).toHaveBeenCalledWith('clip_extended', { props: { from: '1s', to: '3s', trackIndex: 2 } });
  });

  it('omits the options object entirely when no props are given', () => {
    const plausible = vi.fn();
    window.plausible = plausible;

    trackEvent('share_card_downloaded');

    expect(plausible).toHaveBeenCalledWith('share_card_downloaded', undefined);
  });
});
