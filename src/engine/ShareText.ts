import type { PlayerSession } from '../types/session';

/**
 * Builds the shareable emoji-grid result text (Blueprint §10).
 * Each row is one track; each square is one attempted field — green if
 * correct, red/empty if missed. No answers are revealed.
 */
export function buildEmojiGrid(session: PlayerSession, challengeName: string): string {
  const rows = session.tracks.map((track) =>
    track.fields_attempted.map((field) => (track.fields_correct.includes(field) ? '✅' : '❌')).join(''),
  );

  const lines = [
    `🎵 I Know That Tune — ${challengeName}`,
    rows.join(' | '),
    `Score: ${session.totals.total_score.toLocaleString()}`,
  ];

  const comparison = session.comparison;
  if (comparison) {
    const margin = Math.abs(comparison.margin).toLocaleString();
    if (comparison.result === 'win') {
      lines.push(`Beat ${comparison.challenger_name} by ${margin} pts 🏆`);
    } else if (comparison.result === 'loss') {
      lines.push(`Lost to ${comparison.challenger_name} by ${margin} pts`);
    } else {
      lines.push(`Tied with ${comparison.challenger_name}!`);
    }
  }

  return lines.join('\n');
}
