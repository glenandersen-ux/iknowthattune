import type { JSX } from 'react';

export interface DeezerBadgeProps {
  trackUrl: string;
  trackName: string;
  artistName: string;
}

/** Deezer logo mark in white. */
function DeezerLogo(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d="M18.81 12.42h-3.93v1.93h3.93v-1.93zm0-3.34h-3.93v1.93h3.93V9.08zm0-3.34h-3.93v1.93h3.93V5.74zM5.19 18.26h3.93v-1.93H5.19v1.93zm4.87 0h3.93v-1.93H10.06v1.93zm4.87 0h3.93v-1.93h-3.93v1.93zM10.06 15.1h3.93v-1.93h-3.93v1.93zm0-3.34h3.93v-1.93h-3.93v1.93zm-4.87 3.34h3.93v-1.93H5.19v1.93zm0-3.34h3.93v-1.93H5.19v1.93zm0-3.34h3.93V6.49H5.19v1.93z" />
    </svg>
  );
}

/**
 * Attribution badge shown when Deezer audio is playing.
 * Deezer's API terms require linking back to the track.
 */
export function DeezerBadge({ trackUrl, trackName, artistName }: DeezerBadgeProps): JSX.Element {
  return (
    <a
      href={trackUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="deezer-badge"
      aria-label={`Listen to ${trackName} by ${artistName} on Deezer`}
      className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
      style={{ background: '#A238FF' }}
    >
      <DeezerLogo />
      Listen on Deezer
    </a>
  );
}
