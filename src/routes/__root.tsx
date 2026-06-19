import type { JSX } from 'react';
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

export const Route = createRootRoute({
  component: RootComponent,
});

export function RootComponent(): JSX.Element {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isHome = pathname === '/';

  return (
    <>
      {!isHome && (
        <Link
          to="/"
          data-testid="home-button"
          className="fixed top-3 left-3 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg)', fontFamily: 'var(--font-body)' }}
        >
          <span aria-hidden="true">🏠</span>
          Home
        </Link>
      )}
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  );
}
