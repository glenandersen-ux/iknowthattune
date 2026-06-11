/** Result of matching multiple submitted values against an accepted set. */
export interface PartialMatchResult {
  /** Accepted values (canonical form) that were matched, deduplicated. */
  correct: string[];
  /** Submitted values that matched nothing in the accepted set. */
  incorrect: string[];
  /** `correct.length / acceptedSet.length`, or 0 if the accepted set is empty. */
  ratio: number;
}

const normalize = (value: string): string => value.trim().toLowerCase();

/**
 * Levenshtein edit distance between two strings (pure, no dependencies).
 */
export function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) distances[i][0] = i;
  for (let j = 0; j < cols; j += 1) distances[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1, // deletion
        distances[i][j - 1] + 1, // insertion
        distances[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return distances[rows - 1][cols - 1];
}

/**
 * Whether `input` matches `canonical` or any of `aliases` within a
 * Levenshtein distance of `tolerance` (Blueprint §3, default tolerance 2).
 */
export function fuzzyMatch(
  input: string,
  canonical: string,
  aliases: string[] = [],
  tolerance: number = 2,
): boolean {
  const normInput = normalize(input);
  if (normInput.length === 0) return false;
  return [canonical, ...aliases].some(
    (candidate) => levenshteinDistance(normInput, normalize(candidate)) <= tolerance,
  );
}

/**
 * Whether a submitted year is within `tolerance` of the canonical year
 * (Blueprint §3, default tolerance ±2). Accepts numeric or numeric-string input.
 */
export function fuzzyMatchYear(
  input: string | number,
  canonical: number,
  tolerance: number = 2,
): boolean {
  const value = typeof input === 'number' ? input : Number.parseInt(input, 10);
  if (Number.isNaN(value)) return false;
  return Math.abs(value - canonical) <= tolerance;
}

/**
 * Matches each submitted value against an accepted set for partial-credit
 * fields (DeepDive §A.7). Each accepted value can be matched at most once;
 * duplicate submissions of the same value count only once.
 */
export function fuzzyMatchPartial(
  inputs: string[],
  acceptedSet: string[],
  tolerance: number = 2,
): PartialMatchResult {
  const matchedAccepted = new Set<string>();
  const seenInputs = new Set<string>();
  const incorrect: string[] = [];

  for (const input of inputs) {
    const normInput = normalize(input);
    if (seenInputs.has(normInput)) continue;
    seenInputs.add(normInput);

    const match = acceptedSet.find(
      (accepted) =>
        !matchedAccepted.has(accepted) && levenshteinDistance(normInput, normalize(accepted)) <= tolerance,
    );
    if (match) {
      matchedAccepted.add(match);
    } else {
      incorrect.push(input);
    }
  }

  return {
    correct: [...matchedAccepted],
    incorrect,
    ratio: acceptedSet.length > 0 ? matchedAccepted.size / acceptedSet.length : 0,
  };
}
