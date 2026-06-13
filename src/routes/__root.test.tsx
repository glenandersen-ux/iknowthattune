import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const useRouterStateMock = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useRouterState: (opts: { select: (state: { location: { pathname: string } }) => string }) =>
      useRouterStateMock(opts),
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    Outlet: () => <div data-testid="outlet" />,
  };
});

vi.mock('@tanstack/router-devtools', () => ({
  TanStackRouterDevtools: () => null,
}));

import { RootComponent } from './__root';

function setPathname(pathname: string): void {
  useRouterStateMock.mockImplementation(
    (opts: { select: (state: { location: { pathname: string } }) => string }) =>
      opts.select({ location: { pathname } }),
  );
}

describe('RootComponent', () => {
  it('shows a Home button on non-home routes', () => {
    setPathname('/profile');
    render(<RootComponent />);
    expect(screen.getByTestId('home-button')).toHaveAttribute('href', '/');
  });

  it('hides the Home button on the home route', () => {
    setPathname('/');
    render(<RootComponent />);
    expect(screen.queryByTestId('home-button')).not.toBeInTheDocument();
  });
});
