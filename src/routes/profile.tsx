import { useState, type JSX } from 'react';
import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Route as rootRoute } from './__root';
import { usePlayerStore } from '../store/playerStore';
import { BADGE_DEFINITIONS } from '../engine/BadgeEngine';
import { FIELD_DEFINITIONS } from '../engine/ScoringEngine';
import type { FieldId } from '../types/track';

const profileSearchSchema = z.object({});

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  validateSearch: profileSearchSchema,
  loader: async (): Promise<null> => null,
  component: ProfileScreen,
});

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

interface FieldAccuracyListProps {
  title: string;
  accuracy: Partial<Record<FieldId, number>>;
}

function FieldAccuracyList({ title, accuracy }: FieldAccuracyListProps): JSX.Element {
  const entries = Object.entries(accuracy) as [FieldId, number][];

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-800 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">Play more games to see this.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map(([fieldId, ratio]) => (
            <li key={fieldId} className="flex justify-between text-sm">
              <span>{FIELD_DEFINITIONS[fieldId].label}</span>
              <span className="font-semibold">{formatPercent(ratio)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProfileScreen(): JSX.Element {
  const profile = usePlayerStore((state) => state);
  const setDisplayName = usePlayerStore((state) => state.setDisplayName);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.display_name);

  const handleNameSubmit = (): void => {
    const trimmed = nameDraft.trim();
    if (trimmed.length > 0) {
      setDisplayName(trimmed);
    } else {
      setNameDraft(profile.display_name);
    }
    setEditingName(false);
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-4 p-4 text-white">
      <div className="flex flex-col items-center gap-2 text-center">
        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
            }}
            className="rounded-lg bg-slate-800 px-3 py-1 text-center text-2xl font-bold text-white outline-none ring-2 ring-cyan-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(profile.display_name);
              setEditingName(true);
            }}
            className="text-2xl font-bold hover:text-cyan-400"
          >
            {profile.display_name} <span className="text-sm font-normal text-slate-400">(edit)</span>
          </button>
        )}
        {profile.daily_drop_streak > 0 && (
          <p className="text-sm text-amber-400">🔥 {profile.daily_drop_streak}-day streak</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold">{profile.games_played}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">Games Played</p>
        </div>
        <div className="rounded-lg bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold">{formatPercent(profile.accuracy_all_time_pct / 100)}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">Accuracy</p>
        </div>
        <div className="col-span-2 rounded-lg bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold">{profile.best_score_ever.toLocaleString()}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">Best Score</p>
        </div>
      </div>

      <div className="rounded-lg bg-slate-800 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Badges</h3>
        {profile.badges.length === 0 ? (
          <p className="text-sm text-slate-500">No badges yet — keep playing!</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {profile.badges.map((badgeId) => {
              const def = BADGE_DEFINITIONS[badgeId];
              return (
                <li key={badgeId} className="flex items-center gap-2 rounded-lg bg-slate-700 p-2">
                  <span className="text-2xl" aria-hidden="true">{def.icon}</span>
                  <span className="text-sm font-medium">{def.name}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <FieldAccuracyList title="Hardest Fields For You" accuracy={profile.hardest_field_accuracy} />
      <FieldAccuracyList title="Easiest Fields For You" accuracy={profile.easiest_field_accuracy} />
    </div>
  );
}
