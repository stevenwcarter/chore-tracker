import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChoreAssigneeFilter from '../ChoreAssigneeFilter';
import UserImage from '../UserImage';

const users = [
  {
    id: 1,
    uuid: 'u1',
    name: 'Alice',
    imagePath: undefined,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    uuid: 'u2',
    name: 'Bob',
    imagePath: '/images/bob.png',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('ChoreAssigneeFilter', () => {
  it('renders All, one chip per user, and Unassigned', () => {
    render(<ChoreAssigneeFilter users={users} value="all" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bob/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unassigned/i })).toBeInTheDocument();
  });

  it('reports the selected user id', async () => {
    const onChange = vi.fn();
    render(<ChoreAssigneeFilter users={users} value="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /bob/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('reports the unassigned selection', async () => {
    const onChange = vi.fn();
    render(<ChoreAssigneeFilter users={users} value="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /unassigned/i }));
    expect(onChange).toHaveBeenCalledWith('unassigned');
  });

  it('marks only the selected chip as pressed', () => {
    render(<ChoreAssigneeFilter users={users} value={1} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /alice/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /bob/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^all$/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('UserImage size prop', () => {
  it('defaults to the existing large rendering', () => {
    const { container } = render(<UserImage user={users[0]} />);
    expect(container.firstChild).toHaveClass('w-20', 'h-20');
  });

  it('renders a small variant on request', () => {
    const { container } = render(<UserImage user={users[0]} size="sm" />);
    expect(container.firstChild).toHaveClass('w-12', 'h-12');
  });
});
