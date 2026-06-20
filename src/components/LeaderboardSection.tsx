import { useEffect, useState, type JSX } from 'react';
import type { LeaderboardEntry } from '../../workers/api/globalLeaderboard';

function Medal({ rank }: { rank: number }): JSX.Element {
  if (rank === 1) return <span title="1st">🥇</span>;
  if (rank === 2) return <span title="2nd">🥈</span>;
  if (rank === 3) return <span title="3rd">🥉</span>;
  return <span style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-display)' }}>{rank}</span>;
}

function Board({ period, title }: { period: 'daily' | 'weekly'; title: string }): JSX.Element {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leaderboard/global?period=${period}`)
      .then((r) => r.json())
      .then((data) => { setEntries(data as LeaderboardEntry[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-5"
      style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)' }}
    >
      <h3
        className="text-center text-xl uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-display)', color: '#fff' }}
      >
        {title}
      </h3>

      {loading ? (
        <p className="text-center text-sm" style={{ color: 'var(--color-fg-muted)' }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          No scores yet — be the first!
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <li
              key={entry.user_id}
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{ background: i === 0 ? 'rgba(212,255,0,0.06)' : 'transparent' }}
            >
              <span className="w-6 text-center text-sm">{<Medal rank={i + 1} />}</span>
              {entry.avatar_url ? (
                <img src={entry.avatar_url} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--color-violet)', color: '#fff' }}
                >
                  {entry.display_name[0]?.toUpperCase()}
                </span>
              )}
              <span className="flex-1 truncate text-sm" style={{ color: 'var(--color-fg)' }}>
                {entry.display_name}
              </span>
              <span
                className="text-sm font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-spotlight)', fontSize: '1rem' }}
              >
                {Math.round(entry.score).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Shows today's and this week's top-10 leaderboards on the home screen. */
export function LeaderboardSection(): JSX.Element {
  return (
    <section className="mx-auto w-full max-w-lg px-4 pb-16">
      <div className="mb-8 flex items-center gap-4">
        <div className="h-px flex-1" style={{ background: 'var(--color-stage-border)' }} />
        <p
          className="text-xs font-semibold uppercase tracking-[0.3em]"
          style={{ color: 'var(--color-violet)', fontFamily: 'var(--font-body)' }}
        >
          Leaderboards
        </p>
        <div className="h-px flex-1" style={{ background: 'var(--color-stage-border)' }} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Board period="daily" title="Today" />
        <Board period="weekly" title="This Week" />
      </div>
    </section>
  );
}
