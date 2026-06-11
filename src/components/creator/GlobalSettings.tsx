import type { JSX } from 'react';
import type { ChallengeSettings, HintsMode, TimePressure } from '../../types/challenge';

const HOUR_MS = 60 * 60 * 1000;

const TIME_PRESSURE_OPTIONS: { value: TimePressure; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'chill', label: 'Chill' },
];

const HINTS_OPTIONS: { value: HintsMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'category', label: 'Category' },
  { value: 'generous', label: 'Generous' },
];

const EXPIRY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Never' },
  { value: 24 * HOUR_MS, label: '24h' },
  { value: 48 * HOUR_MS, label: '48h' },
  { value: 7 * 24 * HOUR_MS, label: '7d' },
];

export interface GlobalSettingsProps {
  challengeName: string;
  onChangeChallengeName: (name: string) => void;
  creatorName: string;
  onChangeCreatorName: (name: string) => void;
  settings: ChallengeSettings;
  onChangeSettings: (settings: ChallengeSettings) => void;
}

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm font-medium ${
    active ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
  }`;
}

/** Global challenge settings screen for the Challenge Creator wizard (DeepDive §B.5). */
export function GlobalSettings({
  challengeName,
  onChangeChallengeName,
  creatorName,
  onChangeCreatorName,
  settings,
  onChangeSettings,
}: GlobalSettingsProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 text-white">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Challenge Name</span>
        <input
          type="text"
          value={challengeName}
          onChange={(e) => onChangeChallengeName(e.target.value)}
          placeholder="e.g. Glen's 70s Soul Quiz"
          className="rounded-lg bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Your Name</span>
        <input
          type="text"
          value={creatorName}
          onChange={(e) => onChangeCreatorName(e.target.value)}
          placeholder="e.g. Glen"
          className="rounded-lg bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Time Pressure</span>
        <div className="flex flex-wrap gap-2">
          {TIME_PRESSURE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              data-testid={`time-pressure-${value}`}
              onClick={() => onChangeSettings({ ...settings, time_pressure: value })}
              className={chipClass(settings.time_pressure === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Hints</span>
        <div className="flex flex-wrap gap-2">
          {HINTS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              data-testid={`hints-${value}`}
              onClick={() => onChangeSettings({ ...settings, hints: value })}
              className={chipClass(settings.hints === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Expiry</span>
        <div className="flex flex-wrap gap-2">
          {EXPIRY_OPTIONS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              data-testid={`expiry-${label}`}
              onClick={() => onChangeSettings({ ...settings, expiry_ms: value })}
              className={chipClass(settings.expiry_ms === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Leaderboard</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="leaderboard-public"
            onClick={() => onChangeSettings({ ...settings, leaderboard_public: true })}
            className={chipClass(settings.leaderboard_public)}
          >
            Public
          </button>
          <button
            type="button"
            data-testid="leaderboard-private"
            onClick={() => onChangeSettings({ ...settings, leaderboard_public: false })}
            className={chipClass(!settings.leaderboard_public)}
          >
            Private
          </button>
        </div>
      </div>
    </div>
  );
}
