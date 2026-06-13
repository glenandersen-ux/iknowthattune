import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import clsx from 'clsx';
import { DEFAULT_CHOICE_OPTIONS } from '../../engine/FieldMatching';
import type { FieldId, FieldInputType } from '../../types/track';
import type { FieldGuessValue } from '../../types/session';

export interface FieldInputProps {
  fieldId: FieldId;
  type: FieldInputType;
  label: string;
  value: FieldGuessValue;
  onChange: (value: FieldGuessValue) => void;
  /** True once this field has been answered correctly; renders locked/green and disables editing. */
  locked: boolean;
  /** ± tolerance band shown for "year" fields. */
  tolerance?: number;
  /** Catalog values for Fuse.js typeahead, "text" fields only. */
  catalogData?: string[];
  /** Chip options for "choice" fields; falls back to `DEFAULT_CHOICE_OPTIONS`. */
  choices?: string[];
  /**
   * `'regular'` (default) shows autocomplete suggestions for "text" fields;
   * `'expert'` suppresses all suggestions so the player must type unaided.
   */
  assistMode?: 'regular' | 'expert';
}

const MAX_SUGGESTIONS = 8;
const SUGGESTION_DEBOUNCE_MS = 150;
const MIN_CHARS_FOR_SUGGESTIONS = 2;

export function FieldInput({
  fieldId,
  type,
  label,
  value,
  onChange,
  locked,
  tolerance,
  catalogData,
  choices,
  assistMode = 'regular',
}: FieldInputProps): React.ReactElement {
  if (locked) {
    return (
      <div
        className="flex items-center justify-between rounded-lg bg-green-600/30 border border-green-500 px-3 py-2"
        data-testid={`field-${fieldId}-locked`}
      >
        <span className="text-sm font-medium text-green-100">{label}</span>
        <span className="flex items-center gap-2 text-green-300">
          <span aria-hidden>✓</span>
          <span className="font-semibold">{Array.isArray(value) ? value.join(', ') : value}</span>
        </span>
      </div>
    );
  }

  switch (type) {
    case 'text':
      return (
        <TextFieldInput
          fieldId={fieldId}
          label={label}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          catalogData={assistMode === 'expert' ? undefined : catalogData}
        />
      );
    case 'year':
      return (
        <YearFieldInput
          fieldId={fieldId}
          label={label}
          value={value}
          onChange={onChange}
          tolerance={tolerance}
        />
      );
    case 'choice':
      return (
        <ChoiceFieldInput
          fieldId={fieldId}
          label={label}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          choices={choices ?? DEFAULT_CHOICE_OPTIONS[fieldId] ?? []}
        />
      );
    case 'multi':
      return (
        <MultiFieldInput
          fieldId={fieldId}
          label={label}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );
  }
}

interface TextFieldInputProps {
  fieldId: FieldId;
  label: string;
  value: string;
  onChange: (value: string) => void;
  catalogData?: string[];
}

function TextFieldInput({ fieldId, label, value, onChange, catalogData }: TextFieldInputProps): React.ReactElement {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const fuse = useMemo(
    () => (catalogData && catalogData.length > 0 ? new Fuse(catalogData, { threshold: 0.3 }) : null),
    [catalogData],
  );
  // Set when a suggestion is picked, so the resulting value change doesn't
  // immediately reopen the suggestion list with that same value.
  const suppressNextSuggestions = useRef(false);

  useEffect(() => {
    if (suppressNextSuggestions.current) {
      suppressNextSuggestions.current = false;
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      if (!fuse || value.trim().length < MIN_CHARS_FOR_SUGGESTIONS) {
        setSuggestions([]);
        return;
      }
      setSuggestions(fuse.search(value).slice(0, MAX_SUGGESTIONS).map((result) => result.item));
    }, SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, fuse]);

  return (
    <div className="relative" data-testid={`field-${fieldId}`}>
      <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor={`field-${fieldId}-input`}>
        {label}
      </label>
      <input
        id={`field-${fieldId}-input`}
        type="text"
        className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul
          className="absolute z-10 mt-1 w-full rounded-lg bg-slate-800 border border-slate-600 max-h-48 overflow-auto"
          data-testid={`field-${fieldId}-suggestions`}
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-white"
                onClick={() => {
                  suppressNextSuggestions.current = true;
                  onChange(suggestion);
                  setSuggestions([]);
                }}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface YearFieldInputProps {
  fieldId: FieldId;
  label: string;
  value: FieldGuessValue;
  onChange: (value: FieldGuessValue) => void;
  tolerance?: number;
}

function YearFieldInput({ fieldId, label, value, onChange, tolerance }: YearFieldInputProps): React.ReactElement {
  const displayValue = typeof value === 'string' || typeof value === 'number' ? value : '';
  return (
    <div data-testid={`field-${fieldId}`}>
      <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor={`field-${fieldId}-input`}>
        {label}
        {tolerance !== undefined && tolerance > 0 && (
          <span className="ml-1 text-xs text-slate-400">(±{tolerance})</span>
        )}
        {fieldId === 'chart_peak' && <span className="ml-1 text-xs text-slate-400">(Billboard Hot 100)</span>}
      </label>
      <input
        id={`field-${fieldId}-input`}
        type="number"
        inputMode="numeric"
        className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface ChoiceFieldInputProps {
  fieldId: FieldId;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  choices: string[];
}

function ChoiceFieldInput({ fieldId, label, value, onChange, choices }: ChoiceFieldInputProps): React.ReactElement {
  const toggle = (choice: string): void => {
    if (value.includes(choice)) {
      onChange(value.filter((v) => v !== choice));
    } else {
      onChange([...value, choice]);
    }
  };

  return (
    <div data-testid={`field-${fieldId}`}>
      <span className="block text-sm font-medium text-slate-300 mb-1">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => toggle(choice)}
            className={clsx(
              'rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors',
              value.includes(choice)
                ? 'bg-cyan-600 border-cyan-400 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700',
            )}
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}

interface MultiFieldInputProps {
  fieldId: FieldId;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}

function MultiFieldInput({ fieldId, label, value, onChange }: MultiFieldInputProps): React.ReactElement {
  const [draft, setDraft] = useState('');

  const addEntry = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onChange([...value, trimmed]);
    setDraft('');
  };

  const removeEntry = (entry: string): void => {
    onChange(value.filter((v) => v !== entry));
  };

  return (
    <div data-testid={`field-${fieldId}`}>
      <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor={`field-${fieldId}-input`}>
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((entry) => (
          <span
            key={entry}
            className="flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1 text-sm text-white"
          >
            {entry}
            <button
              type="button"
              aria-label={`Remove ${entry}`}
              onClick={() => removeEntry(entry)}
              className="text-slate-300 hover:text-white"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          id={`field-${fieldId}-input`}
          type="text"
          className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addEntry();
            }
          }}
        />
        <button
          type="button"
          onClick={addEntry}
          className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
