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
