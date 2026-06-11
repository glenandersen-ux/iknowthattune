import { useState, type JSX } from 'react';
import QRCode from 'qrcode';
import { generateChallengeId, encodeMiniChallenge } from '../../engine/UrlCodec';
import type { Challenge, CreateChallengeRequest } from '../../types/challenge';

const MAX_MINI_CHALLENGE_TRACKS = 2;

export interface PublishScreenProps {
  challenge: Challenge;
  hasPlayed: boolean;
  onPlayNow: () => void;
}

/** Builds the pre-written share copy for a published challenge (DeepDive §B.6). */
export function buildShareText(challenge: Challenge, url: string): string {
  const name = challenge.name ?? 'I Know That Tune';
  if (challenge.creator_score !== null) {
    return `🎵 Can you beat my score of ${challenge.creator_score.toLocaleString()} pts on "${name}"? ${url}`;
  }
  return `🎵 I made a music trivia challenge: "${name}". Think you know your tunes? ${url}`;
}

interface PublishedChallenge {
  id: string;
  url: string;
}

/** Preview & publish screen for the Challenge Creator wizard (DeepDive §B.6). */
export function PublishScreen({ challenge, hasPlayed, onPlayNow }: PublishScreenProps): JSX.Element {
  const [published, setPublished] = useState<PublishedChallenge | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePublish = async (): Promise<void> => {
    setIsPublishing(true);
    setError(null);
    try {
      const id = generateChallengeId();
      const finalChallenge: Challenge = { ...challenge, id };

      let url: string;
      if (finalChallenge.tracks.length <= MAX_MINI_CHALLENGE_TRACKS) {
        url = `${window.location.origin}/?mini=${encodeMiniChallenge(finalChallenge)}`;
      } else {
        const request: CreateChallengeRequest & { id: string } = {
          id,
          creator_name: finalChallenge.creator_name,
          creator_player_id: finalChallenge.creator_player_id,
          creator_score: finalChallenge.creator_score,
          name: finalChallenge.name,
          tracks: finalChallenge.tracks,
          active_params: finalChallenge.active_params,
          clip_starts: finalChallenge.clip_starts,
          settings: finalChallenge.settings,
          scoring: finalChallenge.scoring,
        };
        try {
          await fetch('/api/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          });
        } catch {
          // No backend available in local dev — the share link will resolve once deployed.
        }
        url = `${window.location.origin}/?c=${id}`;
      }

      const qr = await QRCode.toDataURL(url);
      setPublished({ id, url });
      setQrDataUrl(qr);
    } catch {
      setError('Could not publish challenge. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = (): void => {
    if (!published) return;
    void navigator.clipboard.writeText(published.url);
    setCopied(true);
  };

  const handleCopyShareText = (): void => {
    if (!published) return;
    void navigator.clipboard.writeText(buildShareText(challenge, published.url));
  };

  if (!published) {
    return (
      <div className="flex flex-col gap-4 text-white">
        <h2 className="text-xl font-bold">Preview & Publish</h2>
        <p className="text-sm text-slate-400">
          {challenge.tracks.length} track{challenge.tracks.length === 1 ? '' : 's'} · {challenge.name ?? 'Untitled Challenge'}
        </p>

        {!hasPlayed && (
          <button
            type="button"
            onClick={onPlayNow}
            className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500"
          >
            🎮 Play My Challenge Now
          </button>
        )}

        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={isPublishing}
          className="rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-500 disabled:opacity-50"
        >
          {isPublishing ? 'Publishing…' : hasPlayed ? '🚀 Publish Challenge' : 'Skip & Publish'}
        </button>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  const shareText = buildShareText(challenge, published.url);

  return (
    <div className="flex flex-col gap-4 text-white">
      <h2 className="text-xl font-bold">Your Challenge is Live!</h2>

      <div className="flex items-center gap-2 rounded-lg bg-slate-800 p-3">
        <input type="text" readOnly value={published.url} className="flex-1 bg-transparent text-sm text-slate-200" />
        <button type="button" onClick={handleCopyLink} className="rounded-full bg-cyan-600 px-3 py-1 text-sm font-semibold hover:bg-cyan-500">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {qrDataUrl && <img src={qrDataUrl} alt="Challenge QR code" className="mx-auto h-40 w-40" />}

      <div className="flex flex-wrap justify-center gap-2">
        <a
          href={`sms:&body=${encodeURIComponent(shareText)}`}
          className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600"
        >
          💬 iMessage
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600"
        >
          📱 WhatsApp
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600"
        >
          🐦 Twitter
        </a>
        <button
          type="button"
          onClick={handleCopyShareText}
          className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600"
        >
          📸 Instagram
        </button>
        <a
          href={`mailto:?subject=${encodeURIComponent('I Know That Tune')}&body=${encodeURIComponent(shareText)}`}
          className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600"
        >
          ✉️ Email
        </a>
      </div>
    </div>
  );
}
