import type { JSX } from 'react';
import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Route as rootRoute } from './__root';

const createSearchSchema = z.object({});

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/create',
  validateSearch: createSearchSchema,
  loader: async (): Promise<null> => null,
  component: ChallengeCreate,
});

function ChallengeCreate(): JSX.Element {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold">Create</h1>
    </div>
  );
}
