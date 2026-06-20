import { useEffect, type JSX } from 'react';
import { createRootRoute, Link, Outlet, useRouterState, useSearch } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import { LoginButton } from '../components/auth/LoginButton';
import { UserMenu } from '../components/auth/UserMenu';

export const Route = createRootRoute({
  component: RootComponent,
});

export function RootComponent(): JSX.Element {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isHome = pathname === '/';

  const checkSession = useAuthStore((state) => state.checkSession);
  const syncStats = useAuthStore((state) => state.syncStats);
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const playerStats = usePlayerStore();

  // Read the OAuth exchange code before TanStack Router strips unknown params.
  // strict:false lets useSearch work from the root without a route match.
  const routeSearch = useSearch({ strict: false }) as { auth_exchange?: string };
  const authExchange = routeSearch.auth_exchange;

  useEffect(() => {
    void checkSession(authExchange);
  }, [checkSession, authExchange]);

  // When the user logs in, push their local stats to the server.
  useEffect(() => {
    if (!user) return;
    const { checkSession: _cs, logout: _lo, syncStats: _sy, ...stats } = playerStats as unknown as Record<string, unknown>;
    void syncStats(stats);
  }, [user, syncStats, playerStats]);

  return (
    <>
      {/* Fixed top bar: Home button (non-home pages) + auth controls */}
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-3 py-2">
        {!isHome ? (
          <Link
            to="/"
            data-testid="home-button"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg)', fontFamily: 'var(--font-body)' }}
          >
            <span aria-hidden="true">🏠</span>
            Home
          </Link>
        ) : (
          <div />
        )}

        {/* Auth: show nothing while loading, login button when logged out, user menu when logged in */}
        {!authLoading && (
          user ? <UserMenu user={user} /> : <LoginButton />
        )}
      </div>

      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  );
}
