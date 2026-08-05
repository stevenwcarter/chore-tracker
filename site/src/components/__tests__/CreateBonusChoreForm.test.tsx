import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import '@testing-library/jest-dom';
import CreateBonusChoreForm from '../CreateBonusChoreForm';
import { CREATE_BONUS_CHORE } from 'graphql/queries';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'react-toastify';

// The component defaults its date field to "today", computed the same way it does
// internally, so the mock's variables match exactly regardless of what day the
// suite runs on.
const TODAY = new Date().toISOString().split('T')[0];

function renderForm(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <CreateBonusChoreForm currentAdminId={1} />
    </MockedProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateBonusChoreForm', () => {
  it('submits the mutation with variables.chore (not variables.input) and paymentType DAILY', async () => {
    const user = userEvent.setup();

    const mocks: MockedResponse[] = [
      {
        request: {
          query: CREATE_BONUS_CHORE,
          variables: {
            chore: {
              name: 'Sweep the porch',
              description: null,
              paymentType: 'DAILY',
              amountCents: 250,
              requiredDays: 0,
              active: true,
              createdByAdminId: 1,
              bonusDate: TODAY,
              maxClaims: null,
            },
          },
        },
        result: {
          data: {
            createBonusChore: {
              id: 7,
              uuid: 'bonus-7',
              name: 'Sweep the porch',
              bonusDate: TODAY,
              maxClaims: null,
            },
          },
        },
      },
    ];

    renderForm(mocks);

    await user.type(screen.getByLabelText(/name/i), 'Sweep the porch');
    await user.type(screen.getByLabelText(/amount/i), '2.50');
    await user.click(screen.getByRole('button', { name: /create bonus chore/i }));

    // MockedProvider only resolves when the request's document + variables match
    // this mock exactly. A mismatch (e.g. `input:` instead of `chore:`, or a
    // lowercase `'daily'` instead of `'DAILY'`) leaves the mock unconsumed, the
    // mutation rejects, and the component's onError fires toast.error instead.
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Bonus chore created!'));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
