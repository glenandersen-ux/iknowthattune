import { createRouter } from '@tanstack/react-router';
import { Route as rootRoute } from './routes/__root';
import { Route as indexRoute } from './routes/index';
import { Route as gameRoute } from './routes/game';
import { Route as resultRoute } from './routes/result';
import { Route as createRoute } from './routes/create';
import { Route as profileRoute } from './routes/profile';
import { Route as leaderboardRoute } from './routes/leaderboard';

const routeTree = rootRoute.addChildren([
  indexRoute,
  gameRoute,
  resultRoute,
  createRoute,
  profileRoute,
  leaderboardRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
