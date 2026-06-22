import { useState } from 'react';
import { FieldInput } from './FieldInput';
import { evaluateFieldGuess, type FieldMatchResult } from '../../engine/FieldMatching';
import { FIELD_DEFINITIONS } from '../../engine/ScoringEngine';
import type { FieldId, Track } from '../../types/track';
import type { FieldGuess, FieldGuessValue } from '../../types/session';

export interface GuessPanelProps {
  track: Track;
  activeFields: FieldId[];
  fieldTries: Partial<Record<FieldId, string[]>>;
  assistMode?: 'regular' | 'expert';
  onSubmit: (results: Partial<Record<FieldId, FieldMatchResult>>, guesses: FieldGuess[]) => void;
  onGiveUp: () => void;
  /** Called each time a hint penalty is incurred so the game store can record it. */
  onHintPenalty?: (pts: number) => void;
}

type HintStage = 'none' | 'letter_confirm' | 'letter_shown' | 'answer_confirm' | 'answer_shown';

interface FieldHintState {
  stage: HintStage;
  firstLetter?: string;
  fullAnswer?: string;
}

const LETTER_HINT_COST = 50;
const ANSWER_HINT_COST = 100;

function defaultValueFor(fieldId: FieldId): FieldGuessValue {
  const inputType = FIELD_DEFINITIONS[fieldId].inputType;
  return inputType === 'choice' || inputType === 'multi' ? [] : '';
}

function toleranceFor(track: Track, fieldId: FieldId): number | undefined {
  const answer = track.answers[fieldId];
  return 'tolerance' in answer ? answer.tolerance : undefined;
}

/** Returns the first letter/digit of a field's canonical answer. */
function getFirstLetter(track: Track, fieldId: FieldId): string {
  const answer = track.answers[fieldId];
  if (!('value' in answer) || answer.value === null) return '?';
  const val = answer.value;
  if (typeof val === 'string') return val.trimStart()[0]?.toUpperCase() ?? '?';
  if (typeof val === 'number') return String(val)[0] ?? '?';
  if (Array.isArray(val) && val.length > 0) return String(val[0]).trimStart()[0]?.toUpperCase() ?? '?';
  return '?';
}

/** Returns a human-readable string for the field's canonical answer. */
function getFullAnswer(track: Track, fieldId: FieldId): string {
  const answer = track.answers[fieldId];
  if (!('value' in answer) || answer.value === null) return 'Unknown';
  const val = answer.value;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.join(', ') || 'Unknown';
  return 'Unknown';
}

/** Inline Yes/No confirmation strip shown below a field. */
function HintConfirm({
  message,
  cost,
  onYes,
  onNo,
}: {
  message: string;
  cost: number;
  onYes: () => void;
  onNo: () => void;
}): React.ReactElement {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--color-stage)', border: '1px solid var(--color-stage-border)' }}
    >
      <span style={{ color: 'var(--color-fg)' }}>
        {message}{' '}
        <span style={{ color: 'var(--color-incorrect)', fontFamily: 'var(--font-display)' }}>−{cost} pts</span>
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onYes}
          className="rounded-md px-3 py-1 text-xs font-bold transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-spotlight)', color: 'var(--color-stage)' }}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={onNo}
          className="rounded-md px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg-muted)' }}
        >
          No
        </button>
      </div>
    </div>
  );
}

export function GuessPanel({
  track,
  activeFields,
  fieldTries,
  assistMode = 'regular',
  onSubmit,
  onGiveUp,
  onHintPenalty,
}: GuessPanelProps): React.ReactElement {
  const [values, setValues] = useState<Partial<Record<FieldId, FieldGuessValue>>>({});
  const [locked, setLocked] = useState<Partial<Record<FieldId, FieldMatchResult>>>({});
  const [hintStates, setHintStates] = useState<Partial<Record<FieldId, FieldHintState>>>({});

  const getHint = (fieldId: FieldId): FieldHintState => hintStates[fieldId] ?? { stage: 'none' };
  const setHint = (fieldId: FieldId, state: FieldHintState): void =>
    setHintStates((prev) => ({ ...prev, [fieldId]: state }));

  const handleChange = (fieldId: FieldId, value: FieldGuessValue): void => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (): void => {
    const results: Partial<Record<FieldId, FieldMatchResult>> = { ...locked };
    const guesses: FieldGuess[] = [];
    const newlyLocked: Partial<Record<FieldId, FieldMatchResult>> = {};

    for (const fieldId of activeFields) {
      if (locked[fieldId]) continue;
      const value = values[fieldId] ?? defaultValueFor(fieldId);
      guesses.push({ fieldId, value });
      const def = FIELD_DEFINITIONS[fieldId];
      const result = evaluateFieldGuess(def.inputType, value, track.answers[fieldId]);
      results[fieldId] = result;
      if (result.correct) newlyLocked[fieldId] = result;
    }

    if (Object.keys(newlyLocked).length > 0) setLocked((prev) => ({ ...prev, ...newlyLocked }));
    onSubmit(results, guesses);
  };

  const allLocked = activeFields.every((fieldId) => locked[fieldId]?.correct || getHint(fieldId).stage === 'answer_shown');

  return (
    <div className="flex flex-col gap-4" data-testid="guess-panel">
      {activeFields.map((fieldId) => {
        const def = FIELD_DEFINITIONS[fieldId];
        const isLocked = Boolean(locked[fieldId]?.correct);
        const hint = getHint(fieldId);
        const isAnswerRevealed = hint.stage === 'answer_shown';

        // Build the hint control rendered inline with the field label.
        const hintControl =
          isLocked || isAnswerRevealed || hint.stage === 'letter_confirm' || hint.stage === 'answer_confirm'
            ? null
            : hint.stage === 'none'
              ? (
                  <button
                    type="button"
                    onClick={() => setHint(fieldId, { stage: 'letter_confirm' })}
                    className="rounded-full px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg-muted)' }}
                  >
                    Tip
                  </button>
                )
              : hint.stage === 'letter_shown'
                ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--color-spotlight)' }}>
                        First: <strong>{hint.firstLetter}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setHint(fieldId, { ...hint, stage: 'answer_confirm' })}
                        className="rounded-full px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80"
                        style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-incorrect)', color: 'var(--color-incorrect)' }}
                      >
                        Answer
                      </button>
                    </div>
                  )
                : null;

        return (
          <div key={fieldId} className="flex flex-col gap-1.5">

            {/* Inline confirmation for letter hint */}
            {hint.stage === 'letter_confirm' && (
              <HintConfirm
                message="Show first letter?"
                cost={LETTER_HINT_COST}
                onYes={() => {
                  const letter = getFirstLetter(track, fieldId);
                  setHint(fieldId, { stage: 'letter_shown', firstLetter: letter });
                  onHintPenalty?.(LETTER_HINT_COST);
                }}
                onNo={() => setHint(fieldId, { stage: 'none' })}
              />
            )}

            {/* Inline confirmation for answer */}
            {hint.stage === 'answer_confirm' && (
              <HintConfirm
                message="Reveal the answer?"
                cost={ANSWER_HINT_COST}
                onYes={() => {
                  const answer = getFullAnswer(track, fieldId);
                  setHint(fieldId, { stage: 'answer_shown', fullAnswer: answer });
                  // Lock the field as incorrect (0 pts) so it's excluded from future scoring.
                  setLocked((prev) => ({ ...prev, [fieldId]: { correct: false, partial: 0 } }));
                  onHintPenalty?.(ANSWER_HINT_COST);
                }}
                onNo={() => setHint(fieldId, { ...(hint.stage === 'answer_confirm' ? { ...hint, stage: 'letter_shown' } : { stage: 'none' }) })}
              />
            )}

            {/* Answer revealed banner */}
            {isAnswerRevealed && (
              <div
                className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgb(251,146,60)', color: 'rgb(251,146,60)' }}
              >
                {hint.fullAnswer}
                <span className="ml-2 text-xs font-normal opacity-70">revealed</span>
              </div>
            )}

            {/* Field input — label lives inside FieldInput, hint control passed inline */}
            {!isAnswerRevealed && (
              <FieldInput
                fieldId={fieldId}
                type={def.inputType}
                label={def.label}
                value={values[fieldId] ?? defaultValueFor(fieldId)}
                onChange={(value) => handleChange(fieldId, value)}
                locked={isLocked}
                tolerance={toleranceFor(track, fieldId)}
                catalogData={fieldTries[fieldId]}
                assistMode={assistMode}
                labelExtra={hintControl}
              />
            )}
          </div>
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
