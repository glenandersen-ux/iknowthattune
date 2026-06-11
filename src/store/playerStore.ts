import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BadgeId, PlayerProfile, PlayerSession } from '../types/session';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const yesterdayIso = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

function createDefaultProfile(): PlayerProfile {
  return {
    player_id: crypto.randomUUID(),
    display_name: 'Player',
    created_at: new Date().toISOString(),
    games_played: 0,
    games_created: 0,
    challenges_shared: 0,
    challenges_received: 0,
    total_score_all_time: 0,
    avg_score_per_game: 0,
    best_score_ever: 0,
    perfect_tracks: 0,
    accuracy_all_time_pct: 0,
    favorite_genres: [],
    hardest_field_accuracy: {},
    easiest_field_accuracy: {},
    badges: [],
    challenges_beaten: [],
    daily_drop_streak: 0,
    daily_drop_streak_date: null,
  };
}

/** Persistent player identity and lifetime stats (TechStack §D.4, Blueprint §11). */
export interface PlayerStore extends PlayerProfile {
  /** Updates lifetime stats and the daily streak after a completed session. */
  updateAfterGame: (session: PlayerSession) => void;
  setDisplayName: (name: string) => void;
  unlockBadge: (badge: BadgeId) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      ...createDefaultProfile(),

      updateAfterGame: (session) => {
        const state = get();
        const score = session.totals.total_score;
        const gamesPlayed = state.games_played + 1;
        const totalScore = state.total_score_all_time + score;

        let dailyDropStreak = state.daily_drop_streak;
        if (session.mode === 'daily') {
          const today = todayIso();
          const lastPlayed = state.daily_drop_streak_date;
          if (lastPlayed === today) {
            // Already counted today; no-op.
          } else if (lastPlayed === yesterdayIso()) {
            dailyDropStreak += 1;
          } else {
            dailyDropStreak = 1;
          }
        }

        set({
          games_played: gamesPlayed,
          total_score_all_time: totalScore,
          avg_score_per_game: totalScore / gamesPlayed,
          best_score_ever: Math.max(state.best_score_ever, score),
          perfect_tracks: state.perfect_tracks + session.totals.tracks_perfect,
          accuracy_all_time_pct:
            (state.accuracy_all_time_pct * state.games_played + session.totals.accuracy_pct) /
            gamesPlayed,
          daily_drop_streak: dailyDropStreak,
          daily_drop_streak_date: session.mode === 'daily' ? todayIso() : state.daily_drop_streak_date,
        });
      },

      setDisplayName: (name) => set({ display_name: name }),

      unlockBadge: (badge) => {
        const { badges } = get();
        if (badges.includes(badge)) return;
        set({ badges: [...badges, badge] });
      },
    }),
    {
      name: 'iktt-player',
      version: 1,
      migrate: (persistedState, version): PlayerStore => {
        const state = persistedState as Partial<PlayerStore> & Record<string, unknown>;
        if (version < 1) {
          return { ...createDefaultProfile(), ...state } as PlayerStore;
        }
        return state as PlayerStore;
      },
    },
  ),
);
