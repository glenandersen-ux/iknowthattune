import { useState, type JSX } from 'react';
import { useAuthStore, type AuthUser } from '../../store/authStore';

interface UserMenuProps {
  user: AuthUser;
}

export function UserMenu({ user }: UserMenuProps): JSX.Element {
  const logout = useAuthStore((state) => state.logout);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="user-menu-button"
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
        style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg)' }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs" style={{ background: 'var(--color-violet)', color: '#fff' }}>
            {user.display_name[0]?.toUpperCase()}
          </span>
        )}
        <span className="hidden sm:inline">{user.display_name}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[160px] rounded-xl py-1 shadow-xl"
          style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)' }}
          role="menu"
        >
          <p className="px-4 py-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>{user.email}</p>
          <div className="my-1 h-px" style={{ background: 'var(--color-stage-border)' }} />
          <button
            type="button"
            role="menuitem"
            onClick={() => { void logout(); setOpen(false); }}
            data-testid="logout-button"
            className="w-full px-4 py-2 text-left text-sm transition-colors hover:opacity-80"
            style={{ color: 'var(--color-incorrect)' }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
