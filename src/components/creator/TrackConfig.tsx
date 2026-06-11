import { useMemo, type JSX } from 'react';
import { FIELD_DEFINITIONS, computeMaxPossibleScore } from '../../engine/ScoringEngine';
import { DEFAULT_CHALLENGE_SCORING } from '../../engine/ChallengeBuilder';
import type { ClipStart, FieldId, Track } from '../../types/track';
import type { Challenge } from '../../types/challenge';

const FIELD_ORDER: FieldId[] = Object.keys(FIELD_DEFINITIONS) as FieldId[];

/** Quick preset field sets per DeepDive §B.4. "Sadistic" expands to every available field. */
const PRESETS: Record<'Easy' | 'Medium' | 'Hard' | 'Sadistic', FieldId[] | 'all'> = {
  Easy: ['song_title', 'primary_artist', 'release_year'],
  Medium: ['song_title', 'primary_artist', 'release_year', 'album_name', 'genre'],
  Hard: ['song_title', 'primary_artist', 'release_year', 'album_name', 'genre', 'songwriter', 'record_label'],
  Sadistic: 'all',
};

const CLIP_STARTS: { value: ClipStart; label: string }[] = [
  { value: 'hook', label: 'Hook' },
  { value: 'intro', label: 'Intro' },
  { value: 'outro', label: 'Outro' },
];

export interface TrackConfigProps {
  track: Track;
  activeFields: FieldId[];
  onChangeFields: (fields: FieldId[]) => void;
  clipStart: ClipStart;
  onChangeClipStart: (start: ClipStart) => void;
}

/** A field is only selectable if the track actually has data for it. */
function isFieldAvailable(track: Track, fieldId: FieldId): boolean {
  const value = track.answers[fieldId].value;
  if (value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Per-track parameter checklist for the Challenge Creator wizard (DeepDive §B.4). */
export function TrackConfig({
  track,
  activeFields,
  onChangeFields,
  clipStart,
  onChangeClipStart,
}: TrackConfigProps): JSX.Element {
  const availableFields = useMemo(() => FIELD_ORDER.filter((fieldId) => isFieldAvailable(track, fieldId)), [track]);

  const maxScore = useMemo(() => {
    const challenge: Challenge = {
      id: 'preview',
      version: 1,
      created_at: 0,
      creator_name: '',
      creator_player_id: '',
      creator_score: null,
      name: 'preview',
      tracks: [track.track_id],
      active_params: { [track.track_id]: activeFields },
      clip_starts: { [track.track_id]: clipStart },
      settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
      scoring: DEFAULT_CHALLENGE_SCORING,
    };
    return computeMaxPossibleScore(challenge, [track]);
  }, [track, activeFields, clipStart]);

  const toggleField = (fieldId: FieldId): void => {
    if (!isFieldAvailable(track, fieldId)) return;
    onChangeFields(
      activeFields.includes(fieldId) ? activeFields.filter((f) => f !== fieldId) : [...activeFields, fieldId],
    );
  };

  const applyPreset = (preset: keyof typeof PRESETS): void => {
    const fields = PRESETS[preset];
    onChangeFields(fields === 'all' ? availableFields : fields.filter((f) => availableFields.includes(f)));
  };

  return (
    <div className="flex flex-col gap-3 text-white">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((preset) => (
          <button
            key={preset}
            type="button"
            data-testid={`preset-${preset}`}
            onClick={() => applyPreset(preset)}
            className="rounded-full bg-slate-700 px-3 py-1 text-sm font-semibold hover:bg-slate-600"
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FIELD_ORDER.map((fieldId) => {
          const available = isFieldAvailable(track, fieldId);
          const active = activeFields.includes(fieldId);
          return (
            <button
              key={fieldId}
              type="button"
              data-testid={`param-${fieldId}`}
              disabled={!available}
              onClick={() => toggleField(fieldId)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                !available
                  ? 'cursor-not-allowed bg-slate-900 text-slate-600'
                  : active
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {FIELD_DEFINITIONS[fieldId].label}
              {!available && ' ⚠ not available'}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400">Clip start:</span>
        {CLIP_STARTS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            data-testid={`clip-start-${value}`}
            onClick={() => onChangeClipStart(value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              clipStart === value ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-right text-sm font-semibold text-slate-300">Max score: {maxScore.toLocaleString()}</p>
    </div>
  );
}
