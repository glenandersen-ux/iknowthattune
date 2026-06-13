import { useState } from 'react';
import { FieldInput } from './FieldInput';
import { evaluateFieldGuess, type FieldMatchResult } from '../../engine/FieldMatching';
import { FIELD_DEFINITIONS } from '../../engine/ScoringEngine';
import type { FieldId, Track } from '../../types/track';
import type { FieldGuess, FieldGuessValue } from '../../types/session';

export interface GuessPanelProps {
  track: Track;
  /** Fields the player must guess for this track (`Challenge.active_params[trackId]`). */
  activeFields: FieldId[];
  /** Per-field autocomplete values from `catalogStore` (text fields only). */
  fieldTries: Partial<Record<FieldId, string[]>>;
  /**
   * `'regular'` (default) shows autocomplete suggestions for text fields;
   * `'expert'` suppresses all suggestions.
   */
  assistMode?: 'regular' | 'expert';
  /** Called when "Submit Guess" is pressed, with match results and raw guesses for every active field. */
  onSubmit: (results: Partial<Record<FieldId, FieldMatchResult>>, guesses: FieldGuess[]) => void;
  /** Called when "Give Up" is pressed; scores 0 and reveals answers. */
  onGiveUp: () => void;
}

function defaultValueFor(fieldId: FieldId): FieldGuessValue {
  const inputType = FIELD_DEFINITIONS[fieldId].inputType;
  return inputType === 'choice' || inputType === 'multi' ? [] : '';
}

function toleranceFor(track: Track, fieldId: FieldId): number | undefined {
  const answer = track.answers[fieldId];
  return 'tolerance' in answer ? answer.tolerance : undefined;
}

/** Renders one `<FieldInput>` per active field and submits all unlocked fields together. */
export function GuessPanel({
  track,
  activeFields,
  fieldTries,
  assistMode = 'regular',
  onSubmit,
  onGiveUp,
}: GuessPanelProps): React.ReactElement {
  const [values, setValues] = useState<Partial<Record<FieldId, FieldGuessValue>>>({});
  const [locked, setLocked] = useState<Partial<Record<FieldId, FieldMatchResult>>>({});

  const handleChange = (fieldId: FieldId, value: FieldGuessValue): void => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (): void => {
    const results: Partial<Record<FieldId, FieldMatchResult>> = { ...locked };
    const guesses: FieldGuess[] = [];
    const newlyLocked: Partial<Record<FieldId, FieldMatchResult>> = {};

    for (const fieldId of activeFields) {
      const value = values[fieldId] ?? defaultValueFor(fieldId);
      guesses.push({ fieldId, value });

      if (locked[fieldId]) continue;

      const def = FIELD_DEFINITIONS[fieldId];
      const result = evaluateFieldGuess(def.inputType, value, track.answers[fieldId]);
      results[fieldId] = result;
      if (result.correct) {
        newlyLocked[fieldId] = result;
      }
    }

    if (Object.keys(newlyLocked).length > 0) {
      setLocked((prev) => ({ ...prev, ...newlyLocked }));
    }

    onSubmit(results, guesses);
  };

  const allLocked = activeFields.every((fieldId) => locked[fieldId]?.correct);

  return (
    <div className="flex flex-col gap-4" data-testid="guess-panel">
      {activeFields.map((fieldId) => {
        const def = FIELD_DEFINITIONS[fieldId];
        const isLocked = Boolean(locked[fieldId]?.correct);
        return (
          <FieldInput
            key={fieldId}
            fieldId={fieldId}
            type={def.inputType}
            label={def.label}
            value={values[fieldId] ?? defaultValueFor(fieldId)}
            onChange={(value) => handleChange(fieldId, value)}
            locked={isLocked}
            tolerance={toleranceFor(track, fieldId)}
            catalogData={fieldTries[fieldId]}
            assistMode={assistMode}
          />
        );
      })}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={allLocked}
          className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
        >
          Submit Guess
        </button>
        <button
          type="button"
          onClick={onGiveUp}
          className="rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-800"
        >
          Give Up
        </button>
      </div>
    </div>
  );
}
