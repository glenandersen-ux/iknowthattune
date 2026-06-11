import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useCatalogStore } from '../../store/catalogStore';
import { difficultyLabel } from '../../engine/DailyDrop';
import type { FilterSet, ParameterTier, Track } from '../../types/track';

const DECADE_LABELS: Record<number, string> = {
  1950: '50s',
  1960: '60s',
  1970: '70s',
  1980: '80s',
  1990: '90s',
  2000: '00s',
  2010: '10s',
  2020: '20s',
};

const DIFFICULTY_OPTIONS: { tier: ParameterTier; label: string }[] = [
  { tier: 1, label: 'Easy' },
  { tier: 2, label: 'Medium' },
  { tier: 3, label: 'Hard' },
];

export interface CatalogSearchProps {
  selectedTrackIds: string[];
  onToggleTrack: (track: Track) => void;
  maxTracks?: number;
}

function trackGenres(track: Track): string[] {
  const value = track.answers.genre.value;
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm font-medium ${
    active ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
  }`;
}

/** Catalog search/browse screen for the Challenge Creator wizard (DeepDive §B.2). */
export function CatalogSearch({ selectedTrackIds, onToggleTrack, maxTracks = 10 }: CatalogSearchProps): JSX.Element {
  const tracks = useCatalogStore((state) => state.tracks);
  const search = useCatalogStore((state) => state.search);
  const loadCatalog = useCatalogStore((state) => state.loadCatalog);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterSet>({});
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const track of tracks) trackGenres(track).forEach((g) => set.add(g));
    return [...set].sort();
  }, [tracks]);

  const decades = useMemo(() => {
    const set = new Set<number>();
    for (const track of tracks) set.add(track.metadata.decade);
    return [...set].sort();
  }, [tracks]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const track of tracks) set.add(track.metadata.language);
    return [...set].sort();
  }, [tracks]);

  const results = search(query, filters);
  const atMax = selectedTrackIds.length >= maxTracks;

  const toggleArrayFilter = (key: 'genre' | 'language', value: string): void => {
    setFilters((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next.length > 0 ? next : undefined };
    });
  };

  const toggleDecadeFilter = (value: number): void => {
    setFilters((prev) => {
      const current = prev.decade ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, decade: next.length > 0 ? next : undefined };
    });
  };

  const toggleDifficultyFilter = (tier: ParameterTier): void => {
    setFilters((prev) => {
      const current = prev.difficulty ?? [];
      const next = current.includes(tier) ? current.filter((v) => v !== tier) : [...current, tier];
      return { ...prev, difficulty: next.length > 0 ? next : undefined };
    });
  };

  const toggleNicheFilter = (): void => {
    setFilters((prev) => ({ ...prev, hasNicheTrivia: prev.hasNicheTrivia ? undefined : true }));
  };

  const handlePreview = (track: Track): void => {
    const audio = audioRef.current;
    if (!audio) return;
    if (previewingId === track.track_id) {
      audio.pause();
      setPreviewingId(null);
      return;
    }
    audio.src = track.clip_urls['5s'];
    void audio.play();
    setPreviewingId(track.track_id);
  };

  return (
    <div className="flex flex-col gap-3 text-white">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search songs, artists, albums..."
        className="rounded-lg bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500"
        aria-label="Search catalog"
      />

      <div className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <button
            key={genre}
            type="button"
            data-testid={`filter-genre-${genre}`}
            onClick={() => toggleArrayFilter('genre', genre)}
            className={chipClass(filters.genre?.includes(genre) ?? false)}
          >
            {genre}
          </button>
        ))}
        {decades.map((decade) => (
          <button
            key={decade}
            type="button"
            data-testid={`filter-decade-${decade}`}
            onClick={() => toggleDecadeFilter(decade)}
            className={chipClass(filters.decade?.includes(decade) ?? false)}
          >
            {DECADE_LABELS[decade] ?? `${decade}s`}
          </button>
        ))}
        {languages.map((language) => (
          <button
            key={language}
            type="button"
            data-testid={`filter-language-${language}`}
            onClick={() => toggleArrayFilter('language', language)}
            className={chipClass(filters.language?.includes(language) ?? false)}
          >
            {language.toUpperCase()}
          </button>
        ))}
        {DIFFICULTY_OPTIONS.map(({ tier, label }) => (
          <button
            key={tier}
            type="button"
            data-testid={`filter-difficulty-${tier}`}
            onClick={() => toggleDifficultyFilter(tier)}
            className={chipClass(filters.difficulty?.includes(tier) ?? false)}
          >
            {label}
          </button>
        ))}
        <button type="button" data-testid="filter-niche" onClick={toggleNicheFilter} className={chipClass(filters.hasNicheTrivia ?? false)}>
          Has niche trivia
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {results.map((track) => {
          const isSelected = selectedTrackIds.includes(track.track_id);
          const title = track.answers.song_title.value ?? 'Unknown';
          const artist = track.answers.primary_artist.value ?? 'Unknown';
          return (
            <li key={track.track_id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800 p-3">
              <div className="flex flex-col">
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-slate-400">
                  {artist} · {DECADE_LABELS[track.metadata.decade] ?? `${track.metadata.decade}s`} ·{' '}
                  {difficultyLabel(track.metadata.difficulty_score)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid={`preview-${track.track_id}`}
                  onClick={() => handlePreview(track)}
                  className="rounded-full bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
                  aria-label={`Preview ${title}`}
                >
                  {previewingId === track.track_id ? '⏸' : '▶'}
                </button>
                <button
                  type="button"
                  data-testid={`add-${track.track_id}`}
                  disabled={!isSelected && atMax}
                  onClick={() => onToggleTrack(track)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    isSelected ? 'bg-green-600' : 'bg-cyan-600 disabled:opacity-40'
                  }`}
                >
                  {isSelected ? '✓ Added' : '+ Add'}
                </button>
              </div>
            </li>
          );
        })}
        {results.length === 0 && <li className="text-center text-sm text-slate-500">No tracks found.</li>}
      </ul>

      <audio ref={audioRef} className="hidden" data-testid="preview-audio" />

      <p className="text-center text-sm text-slate-400">
        {selectedTrackIds.length}/{maxTracks} tracks
      </p>
    </div>
  );
}
