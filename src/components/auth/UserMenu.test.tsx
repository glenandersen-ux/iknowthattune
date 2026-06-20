import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from './UserMenu';
import { useAuthStore } from '../../store/authStore';

const mockUser = {
  user_id: 'user-1',
  display_name: 'Glen',
  email: 'glen@example.com',
  avatar_url: null,
};

describe('UserMenu', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: mockUser, loading: false });
  });

  it('shows the user initial when there is no avatar', () => {
    render(<UserMenu user={mockUser} />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('opens the dropdown with email and sign-out button on click', async () => {
    render(<UserMenu user={mockUser} />);
    await userEvent.click(screen.getByTestId('user-menu-button'));
    expect(screen.getByText('glen@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();
  });

  it('calls logout and closes the menu when sign out is clicked', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ logout });
    render(<UserMenu user={mockUser} />);
    await userEvent.click(screen.getByTestId('user-menu-button'));
    await userEvent.click(screen.getByTestId('logout-button'));
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument();
  });
});
