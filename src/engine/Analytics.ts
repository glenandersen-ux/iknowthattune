/** Plausible custom events tracked for funnel analysis (TechStack §D.12). */
export type AnalyticsEventName =
  | 'game_started'
  | 'guess_submitted'
  | 'clip_extended'
  | 'game_completed'
  | 'share_initiated'
  | 'share_card_downloaded'
  | 'challenge_created';

type AnalyticsProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    /** Injected by the Plausible script tag in index.html, if loaded. */
    plausible?: (eventName: string, options?: { props?: AnalyticsProps }) => void;
  }
}

/**
 * Fires a Plausible custom event. No-ops silently since the Plausible script
 * isn't loaded — the site uses Cloudflare Web Analytics for pageviews instead.
 * Kept as a stub so these call sites are ready if Plausible is added later.
 */
export function trackEvent(name: AnalyticsEventName, props?: AnalyticsProps): void {
  window.plausible?.(name, props ? { props } : undefined);
}
