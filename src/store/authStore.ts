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
   * Checks the current session. If `authExchange` is provided (the short-lived
   * code placed in the URL by the OAuth callback), it is exchanged for a real
   * session cookie before falling back to the normal /api/auth/me check.
   */
  checkSession: (authExchange?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Pushes the local playerStore snapshot to the server for cross-device sync. */
  syncStats: (stats: Record<string, unknown>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  loading: true,

  checkSession: async (authExchange?: string) => {
    set({ loading: true });
    try {
      if (authExchange) {
        // Swap the short-lived exchange code for a real session cookie.
        // The cookie is set in this normal JSON response (not a redirect),
        // which is the only path where Set-Cookie works through the
        // Cloudflare service binding.
        const exchangeRes = await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: authExchange }),
        });
        if (exchangeRes.ok) {
          const user = (await exchangeRes.json()) as AuthUser;
          set({ user, loading: false });
          // Clean the exchange code from the URL so it doesn't sit in history.
          const params = new URLSearchParams(window.location.search);
          params.delete('auth_exchange');
          const newUrl = params.toString() ? `/?${params.toString()}` : '/';
          window.history.replaceState({}, '', newUrl);
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
