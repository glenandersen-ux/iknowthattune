import { useEffect, useState, type JSX } from 'react';
import { fetchItunesPreview } from '../../engine/ItunesPreview';

export interface AppleMusicLinkProps {
  songTitle: string;
  artistName: string;
}

/**
 * Looks up the track on the iTunes Search API and, if found, renders a link
 * to its Apple Music page. Used on the result screen only — after a track
 * has been revealed — so the lookup can't spoil an in-progress guess.
 */
export function AppleMusicLink({ songTitle, artistName }: AppleMusicLinkProps): JSX.Element | null {
  const [trackViewUrl, setTrackViewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchItunesPreview(songTitle, artistName).then((preview) => {
      if (!cancelled && preview) setTrackViewUrl(preview.trackViewUrl);
    });
    return (): void => {
      cancelled = true;
    };
  }, [songTitle, artistName]);

  if (!trackViewUrl) return null;

  return (
    <a
      href={trackViewUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Listen on Apple Music"
      data-testid="apple-music-link"
      className="text-cyan-400 hover:text-cyan-300"
    >
      🎵
    </a>
  );
}
