import type { JSX } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { resultSearchSchema, type ResultSearch } from './searchSchemas';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/result',
  validateSearch: resultSearchSchema,
  loaderDeps: ({ search }: { search: ResultSearch }): ResultSearch => search,
  loader: async ({ deps }: { deps: ResultSearch }): Promise<ResultSearch> => deps,
  component: ResultScreen,
});

function ResultScreen(): JSX.Element {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold">Result</h1>
    </div>
  );
}
