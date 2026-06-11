import { useState, type JSX } from 'react';
import { BADGE_DEFINITIONS } from '../../engine/BadgeEngine';
import type { BadgeId } from '../../types/session';

export interface BadgeUnlockProps {
  /** Badges newly unlocked this session (`session.unlocked_badges`). */
  badges: BadgeId[];
}

/** Modal shown on the result screen when new badges were unlocked (Phase 3 §3.3). */
export function BadgeUnlock({ badges }: BadgeUnlockProps): JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  if (badges.length === 0 || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-slate-900 p-6 text-center text-white">
        <h2 className="text-xl font-bold">🎉 New Badge{badges.length > 1 ? 's' : ''} Unlocked!</h2>
        <ul className="flex flex-col gap-3">
          {badges.map((id) => {
            const def = BADGE_DEFINITIONS[id];
            return (
              <li key={id} className="flex items-center gap-3 rounded-lg bg-slate-800 p-3 text-left">
                <span className="text-3xl" aria-hidden="true">
                  {def.icon}
                </span>
                <div>
                  <p className="font-semibold">{def.name}</p>
                  <p className="text-sm text-slate-400">{def.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500"
        >
          Nice!
        </button>
      </div>
    </div>
  );
}
