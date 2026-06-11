import type { JSX } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { leaderboardSearchSchema, type LeaderboardSearch } from './searchSchemas';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaderboard',
  validateSearch: leaderboardSearchSchema,
  loaderDeps: ({ search }: { search: LeaderboardSearch }): LeaderboardSearch => search,
  loader: async ({ deps }: { deps: LeaderboardSearch }): Promise<LeaderboardSearch> => deps,
  component: LeaderboardScreen,
});

function LeaderboardScreen(): JSX.Element {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
    </div>
  );
}
