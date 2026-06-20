import { create } from 'zustand';

export interface AuthUser {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

export interface AuthStore {
  user: AuthUser | null;
  /** True while the initial session check is in flight. */
  loading: boolean;
  /**
   * Checks the current session. Reads auth_exchange from the URL if present
   * (placed there by the OAuth callback) and swaps it for a real session
   * before falling back to the normal /api/auth/me cookie check.
   */
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
  /** Pushes the local playerStore snapshot to the server for cross-device sync. */
  syncStats: (stats: Record<string, unknown>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  loading: true,

  checkSession: async () => {
    set({ loading: true });
    try {
      // auth_exchange is now in gameSearchSchema so TanStack Router preserves
      // it in the URL. Read it from window.location.search directly — this is
      // the raw browser URL and is reliable regardless of router state timing.
      const params = new URLSearchParams(window.location.search);
      const exchangeCode = params.get('auth_exchange');

      if (exchangeCode) {
        // Remove the code from the URL immediately so it doesn't sit in history.
        params.delete('auth_exchange');
        const newUrl = params.toString() ? `/?${params.toString()}` : '/';
        window.history.replaceState({}, '', newUrl);

        const exchangeRes = await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: exchangeCode }),
        });
        if (exchangeRes.ok) {
          const user = (await exchangeRes.json()) as AuthUser;
          set({ user, loading: false });
          return;
        }
      }

      const response = await fetch('/api/auth/me');
      const user = (await response.json()) as AuthUser | null;
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    set({ user: null });
  },

  syncStats: async (stats) => {
    const { user } = get();
    if (!user) return;
    await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats),
    }).catch(() => {});
  },
}));
