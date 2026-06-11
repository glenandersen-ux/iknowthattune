import { useState, type JSX } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Route as rootRoute } from './__root';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { CatalogSearch } from '../components/creator/CatalogSearch';
import { TrackList } from '../components/creator/TrackList';
import { TrackConfig } from '../components/creator/TrackConfig';
import { GlobalSettings } from '../components/creator/GlobalSettings';
import { PublishScreen } from '../components/creator/PublishScreen';
import { DEFAULT_ACTIVE_FIELDS, DEFAULT_CHALLENGE_SCORING } from '../engine/ChallengeBuilder';
import type { Challenge, ChallengeSettings } from '../types/challenge';
import type { ClipStart, FieldId, Track } from '../types/track';

const createSearchSchema = z.object({});

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/create',
  validateSearch: createSearchSchema,
  loader: async (): Promise<null> => null,
  component: ChallengeCreate,
});

function ChallengeCreate(): JSX.Element {
  return <ChallengeCreateScreen />;
}

const STEP_LABELS = ['Search', 'Tracks', 'Settings', 'Publish'] as const;

const DEFAULT_SETTINGS: ChallengeSettings = {
  time_pressure: 'standard',
  hints: 'none',
  expiry_ms: null,
  leaderboard_public: true,
};

export function ChallengeCreateScreen(): JSX.Element {
  const navigate = useNavigate();
  const playerId = usePlayerStore((state) => state.player_id);
  const playerName = usePlayerStore((state) => state.display_name);
  const loadChallenge = useGameStore((state) => state.loadChallenge);

  const [step, setStep] = useState(1);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [activeParams, setActiveParams] = useState<Record<string, FieldId[]>>({});
  const [clipStarts, setClipStarts] = useState<Record<string, ClipStart>>({});
  const [challengeName, setChallengeName] = useState('');
  const [creatorName, setCreatorName] = useState(playerName);
  const [settings, setSettings] = useState<ChallengeSettings>(DEFAULT_SETTINGS);
  const [hasPlayed, setHasPlayed] = useState(false);

  const selectedTrackIds = selectedTracks.map((track) => track.track_id);

  const handleToggleTrack = (track: Track): void => {
    setSelectedTracks((prev) => {
      if (prev.some((t) => t.track_id === track.track_id)) {
        return prev.filter((t) => t.track_id !== track.track_id);
      }
      return [...prev, track];
    });
    setActiveParams((prev) => {
      if (prev[track.track_id]) return prev;
      return { ...prev, [track.track_id]: DEFAULT_ACTIVE_FIELDS };
    });
    setClipStarts((prev) => {
      if (prev[track.track_id]) return prev;
      return { ...prev, [track.track_id]: 'hook' };
    });
  };

  const handleRemoveTrack = (trackId: string): void => {
    setSelectedTracks((prev) => prev.filter((t) => t.track_id !== trackId));
  };

  const handleChangeFields = (trackId: string, fields: FieldId[]): void => {
    setActiveParams((prev) => ({ ...prev, [trackId]: fields }));
  };

  const handleChangeClipStart = (trackId: string, clipStart: ClipStart): void => {
    setClipStarts((prev) => ({ ...prev, [trackId]: clipStart }));
  };

  const challenge: Challenge = {
    id: 'preview',
    version: 1,
    created_at: Date.now(),
    creator_name: creatorName.trim() || 'Player',
    creator_player_id: playerId,
    creator_score: null,
    name: challengeName.trim() || null,
    tracks: selectedTrackIds,
    active_params: activeParams,
    clip_starts: clipStarts,
    settings,
    scoring: DEFAULT_CHALLENGE_SCORING,
  };

  const handlePlayNow = (): void => {
    setHasPlayed(true);
    loadChallenge(challenge, 'solo', creatorName.trim() || 'Player');
    void navigate({ to: '/game' });
  };

  const canGoNext = step === 1 ? selectedTracks.length > 0 : true;

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-4 p-4 text-white">
      <h1 className="text-center text-2xl font-bold">Create a Challenge</h1>

      <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
        {STEP_LABELS.map((label, index) => (
          <span key={label} className={index + 1 === step ? 'font-bold text-cyan-400' : ''}>
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {step === 1 && (
        <CatalogSearch selectedTrackIds={selectedTrackIds} onToggleTrack={handleToggleTrack} maxTracks={10} />
      )}

      {step === 2 && (
        <TrackList
          tracks={selectedTracks}
          activeParams={activeParams}
          onReorder={setSelectedTracks}
          onRemove={handleRemoveTrack}
          renderConfig={(track) => (
            <TrackConfig
              track={track}
              activeFields={activeParams[track.track_id] ?? []}
              onChangeFields={(fields) => handleChangeFields(track.track_id, fields)}
              clipStart={clipStarts[track.track_id] ?? 'hook'}
              onChangeClipStart={(clipStart) => handleChangeClipStart(track.track_id, clipStart)}
            />
          )}
        />
      )}

      {step === 3 && (
        <GlobalSettings
          challengeName={challengeName}
          onChangeChallengeName={setChallengeName}
          creatorName={creatorName}
          onChangeCreatorName={setCreatorName}
          settings={settings}
          onChangeSettings={setSettings}
        />
      )}

      {step === 4 && <PublishScreen challenge={challenge} hasPlayed={hasPlayed} onPlayNow={handlePlayNow} />}

      <div className="mt-auto flex justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg bg-slate-700 px-4 py-2 font-semibold hover:bg-slate-600 disabled:opacity-40"
        >
          Back
        </button>
        {step < 4 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            disabled={!canGoNext}
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500 disabled:opacity-40"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
