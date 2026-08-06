import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CreateChoreForm from '../CreateChoreForm';
import { PaymentType, Chore } from 'types/chore';

const users = [
  { id: 1, uuid: 'u1', name: 'Alice', imagePath: undefined, createdAt: '2026-01-01T00:00:00Z' },
];

const seasonalChore = {
  id: 1,
  uuid: 'chore-1',
  name: 'Study spelling',
  description: '',
  amountCents: 100,
  paymentType: PaymentType.Daily,
  requiredDays: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  createdByAdminId: 1,
  assignedUsers: [],
  availabilityWindow: { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 },
} as unknown as Chore;

describe('CreateChoreForm availability window', () => {
  it('sends a null window when the season checkbox is off', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateChoreForm users={users} adminId={1} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/chore title/i), 'Make bed');
    await userEvent.click(screen.getByRole('button', { name: /create chore/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ availabilityWindow: null }),
      [],
    );
  });

  it('sends the window when the season checkbox is on', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateChoreForm users={users} adminId={1} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/chore title/i), 'Study spelling');
    await userEvent.click(screen.getByLabelText(/only available part of the year/i));

    await userEvent.selectOptions(screen.getByLabelText(/available from month/i), '9');
    await userEvent.selectOptions(screen.getByLabelText(/available from day/i), '1');
    await userEvent.selectOptions(screen.getByLabelText(/available until month/i), '6');
    await userEvent.selectOptions(screen.getByLabelText(/available until day/i), '15');

    await userEvent.click(screen.getByRole('button', { name: /create chore/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        availabilityWindow: { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 },
      }),
      [],
    );
  });

  it('prefills both pickers when editing a seasonal chore', () => {
    render(
      <CreateChoreForm
        users={users}
        adminId={1}
        initialChore={seasonalChore}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/only available part of the year/i)).toBeChecked();
    expect(screen.getByLabelText(/available from month/i)).toHaveValue('9');
    expect(screen.getByLabelText(/available from day/i)).toHaveValue('1');
    expect(screen.getByLabelText(/available until month/i)).toHaveValue('6');
    expect(screen.getByLabelText(/available until day/i)).toHaveValue('15');
  });

  it("does not leak one chore's season into the next after a create-mode submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateChoreForm users={users} adminId={1} onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Chore A: a non-default window (differs from the 9/1-6/15 default in all
    // four values), so a leak is unambiguous.
    await userEvent.type(screen.getByLabelText(/chore title/i), 'Shovel snow');
    await userEvent.click(screen.getByLabelText(/only available part of the year/i));
    await userEvent.selectOptions(screen.getByLabelText(/available from month/i), '12');
    await userEvent.selectOptions(screen.getByLabelText(/available from day/i), '1');
    await userEvent.selectOptions(screen.getByLabelText(/available until month/i), '1');
    await userEvent.selectOptions(screen.getByLabelText(/available until day/i), '31');
    await userEvent.click(screen.getByRole('button', { name: /create chore/i }));

    expect(onSubmit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        availabilityWindow: { startMonth: 12, startDay: 1, endMonth: 1, endDay: 31 },
      }),
      [],
    );

    // Chore B, same mounted form: the season checkbox resets to unticked, and
    // re-ticking it must show the default window, not chore A's leftover values.
    expect(screen.getByLabelText(/only available part of the year/i)).not.toBeChecked();

    await userEvent.type(screen.getByLabelText(/chore title/i), 'Rake leaves');
    await userEvent.click(screen.getByLabelText(/only available part of the year/i));
    await userEvent.click(screen.getByRole('button', { name: /create chore/i }));

    expect(onSubmit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        availabilityWindow: { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 },
      }),
      [],
    );
  });

  it('limits February to 29 days', async () => {
    render(<CreateChoreForm users={users} adminId={1} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByLabelText(/only available part of the year/i));
    await userEvent.selectOptions(screen.getByLabelText(/available from month/i), '2');

    const dayOptions = within(screen.getByLabelText(/available from day/i)).getAllByRole('option');
    expect(dayOptions).toHaveLength(29);
  });
});
