import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BadgeUnlock } from './BadgeUnlock';

describe('BadgeUnlock', () => {
  it('renders nothing when no badges were unlocked', () => {
    const { container } = render(<BadgeUnlock badges={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows unlocked badges and dismisses on click', () => {
    render(<BadgeUnlock badges={['first_blood', 'on_fire']} />);
    expect(screen.getByText('First Blood')).toBeInTheDocument();
    expect(screen.getByText('On Fire')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nice!' }));
    expect(screen.queryByText('First Blood')).not.toBeInTheDocument();
  });
});
