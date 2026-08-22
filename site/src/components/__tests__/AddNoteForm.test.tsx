import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddNoteForm from '../AddNoteForm';

describe('AddNoteForm', () => {
  it('renders the Add Note control for admins', () => {
    render(<AddNoteForm isAdmin onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
  });

  it('renders nothing for non-admins, because the mutation requires an admin session', () => {
    const { container } = render(<AddNoteForm isAdmin={false} onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /add note/i })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to non-admin when isAdmin is omitted', () => {
    render(<AddNoteForm onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /add note/i })).not.toBeInTheDocument();
  });
});
