import { create } from 'zustand';

export interface AuthUser {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

export interface AuthStore {
  user: AuthUser | null;
  /** True while the initial `/api/auth/me` check is in flight. */
  loading: boolean;
  /** Fetches the current session from the server. Call once on app mount. */
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
      // If the OAuth callback left an exchange code in the URL, swap it for a
      // real session cookie before checking the session. The code is consumed
      // server-side so it can't be replayed.
      const params = new URLSearchParams(window.location.search);
      const exchangeCode = params.get('auth_exchange');
      if (exchangeCode) {
        // Remove the code from the URL so it doesn't sit in browser history.
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
