import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginButton } from './LoginButton';

describe('LoginButton', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  it('renders a sign-in button', () => {
    render(<LoginButton />);
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('navigates to the Google OAuth start endpoint on click', async () => {
    render(<LoginButton />);
    await userEvent.click(screen.getByTestId('login-button'));
    expect(window.location.href).toBe('/api/auth/google/start');
  });
});
