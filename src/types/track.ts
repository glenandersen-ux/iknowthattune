/** The five pre-rendered clip lengths every track must provide. */
export type ClipDuration = '1s' | '3s' | '5s' | '10s' | '30s';

/** Map of clip duration to its CDN URL. */
export type ClipUrlMap = Record<ClipDuration, string>;

/** Where in the source audio a clip's playback begins. */
export type ClipStart = 'hook' | 'intro' | 'outro';

/** Every guessable field across all parameter tiers (Blueprint §3). */
export type FieldId =
  // Tier 1 — Core
  | 'song_title'
  | 'primary_artist'
  | 'release_year'
  | 'album_name'
  // Tier 2 — Advanced
  | 'songwriter'
  | 'producer'
  | 'record_label'
  | 'genre'
  // Tier 3 — Niche / Expert
  | 'band_members'
  | 'featured_artist'
  | 'bpm'
  | 'key_signature'
  | 'chart_peak'
  | 'sample_source'
  | 'certified_copies'
  | 'music_video_director'
  | 'opening_lyric'
  | 'instrument_solo'
  | 'covered_by'
  | 'soundtrack';

/** Difficulty tier a field belongs to; drives base point value. */
export type ParameterTier = 1 | 2 | 3;

/** UI input variant rendered by `<FieldInput>` for a given field. */
export type FieldInputType = 'text' | 'year' | 'choice' | 'multi';

/** Free-text answer with accepted alternate spellings/names. */
export interface TextAnswer {
  value: string | null;
  aliases: string[];
}

/** Numeric answer accepted within a +/- tolerance band. */
export interface NumericAnswer {
  value: number | null;
  tolerance: number;
}

/**
 * Multi-entity answer (e.g. band members, songwriters) where each
 * accepted value is scored independently for partial credit.
 */
export interface MultiValueAnswer {
  value: string[];
  /** When true, `(correct_count / value.length)` of the field score is awarded. */
  partial_credit?: boolean;
}

/** Single- or multi-select answer drawn from a fixed choice set. */
export interface ChoiceAnswer {
  value: string[] | string | null;
}

/** Free-text answer matched via Levenshtein distance, e.g. opening lyrics. */
export interface FuzzyTextAnswer {
  value: string | null;
  fuzzy_tolerance: number;
}

/** Simple nullable answer with no aliases or tolerance (e.g. key signature). */
export interface SimpleAnswer {
  value: string | null;
}

/** The full set of guessable answers for a track (Blueprint §4). */
export interface TrackAnswers {
  song_title: TextAnswer;
  primary_artist: TextAnswer;
  release_year: NumericAnswer;
  album_name: TextAnswer;
  songwriter: MultiValueAnswer;
  producer: TextAnswer;
  record_label: TextAnswer;
  genre: ChoiceAnswer;
  band_members: MultiValueAnswer;
  featured_artist: SimpleAnswer;
  bpm: NumericAnswer;
  key_signature: SimpleAnswer;
  chart_peak: NumericAnswer;
  sample_source: SimpleAnswer;
  certified_copies: SimpleAnswer;
  music_video_director: SimpleAnswer;
  opening_lyric: FuzzyTextAnswer;
  instrument_solo: ChoiceAnswer;
  covered_by: MultiValueAnswer;
  soundtrack: SimpleAnswer;
}

/** Catalog/curation metadata not used for scoring directly. */
export interface TrackMetadata {
  decade: number;
  language: string;
  tags: string[];
  /** Computed difficulty: <1.5 Easy, 1.5-2.5 Medium, 2.5-3.5 Hard, >3.5 Sadistic. */
  difficulty_score: number;
  /** Curator commentary for contested/historical answer disputes (DeepDive §A.7). */
  curator_note?: string;
}

/** The canonical track object (Blueprint §4). */
export interface Track {
  track_id: string;
  clip_urls: ClipUrlMap;
  /** Offset into the source audio, in milliseconds, where the hook clip begins. */
  clip_start_offset_ms: number;
  answers: TrackAnswers;
  metadata: TrackMetadata;
}

/** Lightweight catalog entry used for search/browse (TechStack §D.6). */
export interface CatalogTrack {
  track_id: string;
  song_title: string;
  primary_artist: string;
  release_year: number;
  album_name: string;
  genre: string[];
  decade: number;
  difficulty_score: number;
  has_niche_trivia: boolean;
  clip_urls: ClipUrlMap;
  tags: string[];
}

/** Filter chips applied to catalog search (Blueprint §2 / DeepDive §B.2). */
export interface FilterSet {
  genre?: string[];
  decade?: number[];
  language?: string[];
  difficulty?: ParameterTier[];
  hasNicheTrivia?: boolean;
}

/** Static definition of a guessable field's scoring properties (DeepDive §A.3). */
export interface FieldDefinition {
  fieldId: FieldId;
  tier: ParameterTier;
  /** Base points before difficulty weight and multipliers are applied. */
  basePoints: number;
  /** Multiplier applied to base points (Blueprint §3). */
  difficultyWeight: number;
  inputType: FieldInputType;
  label: string;
}
