import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import '@testing-library/jest-dom';
import AdminChoreManagement from '../AdminChoreManagement';
import {
  GET_ALL_CHORES,
  GET_ALL_USERS,
  ASSIGN_CHORE_TO_USER,
  UNASSIGN_USER_FROM_CHORE,
} from 'graphql/queries';
import { PaymentType } from 'types/chore';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'react-toastify';

// Fixture data. Alice starts assigned to the one chore; Bob is not, and has an
// existing photo (so the "Remove Photo" button renders for him but not Alice).
const ALICE = {
  id: 1,
  uuid: 'user-uuid-1',
  name: 'Alice',
  imagePath: null,
  createdAt: '2026-01-01T00:00:00Z',
};
const BOB = {
  id: 2,
  uuid: 'user-uuid-2',
  name: 'Bob',
  imagePath: '/images/bob.png',
  createdAt: '2026-01-01T00:00:00Z',
};
const users = [ALICE, BOB];

const WASH_DISHES = {
  id: 10,
  uuid: 'chore-uuid-10',
  name: 'Wash dishes',
  description: 'Every night',
  amountCents: 150,
  paymentType: PaymentType.Daily,
  requiredDays: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  availabilityWindow: null,
  assignedUsers: [{ id: 1, uuid: 'user-uuid-1', name: 'Alice', imageId: null, imagePath: null }],
};
const chores = [WASH_DISHES];

function baseMocks(): MockedResponse[] {
  return [
    { request: { query: GET_ALL_CHORES }, result: { data: { listChores: chores } } },
    { request: { query: GET_ALL_USERS }, result: { data: { listUsers: users } } },
  ];
}

function renderComponent(extraMocks: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[...baseMocks(), ...extraMocks]}>
      <AdminChoreManagement adminId={1} />
    </MockedProvider>,
  );
}

async function waitForLoaded() {
  await screen.findByText('Chore Management');
}

async function openManageUsersModal() {
  await userEvent.click(screen.getByRole('button', { name: /Manage Users/i }));
  await screen.findByRole('heading', { name: 'Manage Users' });
}

function findUserCard(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name, level: 4 });
  const card = heading.closest('div.bg-gray-700.p-4.rounded-lg');
  if (!card) throw new Error(`Could not find management card for ${name}`);
  return card as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminChoreManagement toolbar', () => {
  it('renders all four toolbar buttons', async () => {
    renderComponent();
    await waitForLoaded();

    expect(screen.getByRole('button', { name: /Manage Users/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create New User/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create New Chore/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Bonus Chore/i })).toBeInTheDocument();
  });

  it('opens the User Management modal, listing every user', async () => {
    renderComponent();
    await waitForLoaded();

    await openManageUsersModal();

    expect(screen.getByRole('heading', { name: 'Alice', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bob', level: 4 })).toBeInTheDocument();
  });

  it('opens the Create New User modal', async () => {
    renderComponent();
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Create New User/i }));

    expect(await screen.findByRole('heading', { name: 'Create New User' })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it('opens the Create New Chore modal', async () => {
    renderComponent();
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Create New Chore/i }));

    expect(await screen.findByRole('heading', { name: 'Create New Chore' })).toBeInTheDocument();
    expect(screen.getByLabelText(/chore title/i)).toBeInTheDocument();
  });

  it('opens the Create Bonus Chore modal', async () => {
    renderComponent();
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Create Bonus Chore/i }));

    expect(await screen.findByRole('heading', { name: 'Create Bonus Chore' })).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });
});

describe('AdminChoreManagement chore assignment modal', () => {
  it('opens from a chore card, showing Assign/Unassign per user', async () => {
    renderComponent();
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    const heading = await screen.findByRole('heading', {
      name: `Assign Users: ${WASH_DISHES.name}`,
    });
    const modalRoot = heading.closest('div.fixed.inset-0') as HTMLElement;

    // Alice is already assigned -> "Unassign"; Bob is not -> "Assign".
    expect(within(modalRoot).getByRole('button', { name: 'Unassign' })).toBeInTheDocument();
    expect(within(modalRoot).getByRole('button', { name: 'Assign' })).toBeInTheDocument();
  });

  it('assigns an unassigned user and shows no toast on success', async () => {
    renderComponent([
      {
        request: {
          query: ASSIGN_CHORE_TO_USER,
          variables: { choreId: WASH_DISHES.id, userId: BOB.id },
        },
        result: { data: { assignUserToChore: true } },
      },
      // useRefetchingMutation refetches the chore list on success.
      { request: { query: GET_ALL_CHORES }, result: { data: { listChores: chores } } },
    ]);
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const heading = await screen.findByRole('heading', {
      name: `Assign Users: ${WASH_DISHES.name}`,
    });
    const modalRoot = heading.closest('div.fixed.inset-0') as HTMLElement;

    await userEvent.click(within(modalRoot).getByRole('button', { name: 'Assign' }));

    await waitFor(() => expect(toast.error).not.toHaveBeenCalled());
  });

  it('unassigns an already-assigned user and shows no toast on success', async () => {
    renderComponent([
      {
        request: {
          query: UNASSIGN_USER_FROM_CHORE,
          variables: { choreId: WASH_DISHES.id, userId: ALICE.id },
        },
        result: { data: { unassignUserFromChore: true } },
      },
      { request: { query: GET_ALL_CHORES }, result: { data: { listChores: chores } } },
    ]);
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const heading = await screen.findByRole('heading', {
      name: `Assign Users: ${WASH_DISHES.name}`,
    });
    const modalRoot = heading.closest('div.fixed.inset-0') as HTMLElement;

    await userEvent.click(within(modalRoot).getByRole('button', { name: 'Unassign' }));

    await waitFor(() => expect(toast.error).not.toHaveBeenCalled());
  });

  // Known bug, deliberately NOT fixed by this refactor: both the
  // `useAdminChoreManagement.assignUser` (via withErrorToast) and this
  // component's own `handleAssignUser` catch block toast on failure, so a
  // single failed assignment shows two error toasts. This test pins that
  // behaviour so the extraction doesn't accidentally change it.
  it('shows two error toasts on assignment failure (known double-toast bug, not fixed here)', async () => {
    renderComponent([
      {
        request: {
          query: ASSIGN_CHORE_TO_USER,
          variables: { choreId: WASH_DISHES.id, userId: BOB.id },
        },
        result: { errors: [new GraphQLError('boom')] },
      },
    ]);
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const heading = await screen.findByRole('heading', {
      name: `Assign Users: ${WASH_DISHES.name}`,
    });
    const modalRoot = heading.closest('div.fixed.inset-0') as HTMLElement;

    await userEvent.click(within(modalRoot).getByRole('button', { name: 'Assign' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
    expect(toast.error).toHaveBeenNthCalledWith(1, 'Error assigning user to chore');
    expect(toast.error).toHaveBeenNthCalledWith(2, 'Error assigning chore to user');
  });
});

describe('AdminChoreManagement image upload/remove', () => {
  it('uploads an image via POST /images/upload/:uuid and refetches users on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const usersAfterUpload = [
      ...users,
      {
        id: 3,
        uuid: 'user-uuid-3',
        name: 'Carol',
        imagePath: null,
        createdAt: '2026-01-02T00:00:00Z',
      },
    ];
    renderComponent([
      { request: { query: GET_ALL_USERS }, result: { data: { listUsers: usersAfterUpload } } },
    ]);
    await waitForLoaded();
    await openManageUsersModal();

    const aliceCard = findUserCard('Alice');
    const fileInput = aliceCard.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pixel'], 'avatar.png', { type: 'image/png' });

    await userEvent.upload(fileInput, file);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`/images/upload/${ALICE.uuid}`);
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);

    // Proves refetchUsers actually ran: the second GET_ALL_USERS mock's data
    // (which includes Carol) makes it into the DOM.
    expect(await screen.findByRole('heading', { name: 'Carol', level: 4 })).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows "Failed to upload image" and does not refetch when the server rejects the upload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const usersAfterUpload = [
      ...users,
      {
        id: 3,
        uuid: 'user-uuid-3',
        name: 'Carol',
        imagePath: null,
        createdAt: '2026-01-02T00:00:00Z',
      },
    ];
    renderComponent([
      { request: { query: GET_ALL_USERS }, result: { data: { listUsers: usersAfterUpload } } },
    ]);
    await waitForLoaded();
    await openManageUsersModal();

    const aliceCard = findUserCard('Alice');
    const fileInput = aliceCard.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pixel'], 'avatar.png', { type: 'image/png' });

    await userEvent.upload(fileInput, file);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to upload image'));
    expect(toast.error).toHaveBeenCalledTimes(1);
    // Refetch never ran, so the second (Carol-bearing) mock was never consumed.
    expect(screen.queryByRole('heading', { name: 'Carol', level: 4 })).not.toBeInTheDocument();
  });

  it('shows "Error uploading image" (single toast, no crash) when fetch itself rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    renderComponent();
    await waitForLoaded();
    await openManageUsersModal();

    const aliceCard = findUserCard('Alice');
    const fileInput = aliceCard.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pixel'], 'avatar.png', { type: 'image/png' });

    await userEvent.upload(fileInput, file);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error uploading image'));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('removes an image via DELETE /images/user/:id and refetches users on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const usersAfterRemove = [{ ...BOB, imagePath: null }, ALICE];
    renderComponent([
      { request: { query: GET_ALL_USERS }, result: { data: { listUsers: usersAfterRemove } } },
    ]);
    await waitForLoaded();
    await openManageUsersModal();

    const bobCard = findUserCard('Bob');
    await userEvent.click(within(bobCard).getByRole('button', { name: /remove/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`/images/user/${BOB.id}`);
    expect(options.method).toBe('DELETE');

    // Bob's card no longer shows a remove button once refetchUsers clears his imagePath.
    await waitFor(() => {
      const refreshedBobCard = findUserCard('Bob');
      expect(
        within(refreshedBobCard).queryByRole('button', { name: /remove/i }),
      ).not.toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows "Failed to remove image" and does not refetch when the server rejects the removal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    renderComponent();
    await waitForLoaded();
    await openManageUsersModal();

    const bobCard = findUserCard('Bob');
    await userEvent.click(within(bobCard).getByRole('button', { name: /remove/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to remove image'));
    expect(toast.error).toHaveBeenCalledTimes(1);
    // Bob's card still shows the remove button since no refetch occurred.
    expect(
      within(findUserCard('Bob')).getByRole('button', { name: /remove/i }),
    ).toBeInTheDocument();
  });

  it('shows "Error removing image" (single toast, no crash) when fetch itself rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    renderComponent();
    await waitForLoaded();
    await openManageUsersModal();

    const bobCard = findUserCard('Bob');
    await userEvent.click(within(bobCard).getByRole('button', { name: /remove/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error removing image'));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
