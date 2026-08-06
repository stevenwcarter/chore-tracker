import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import '@testing-library/jest-dom';

// `App` renders `page/PageTemplate` and `page/HomePage` via `React.lazy`, and their
// dynamic `import()` doesn't resolve until Vite/vite-node has transformed that whole
// module graph (PageTemplate, HomePage, and everything HomePage statically pulls in --
// UserSelector, WeeklyChoreView, AdminHomePanel, the GraphQL client, FontAwesome, etc).
// When this file runs alone, nothing else has transformed those modules yet, so the
// cold transform happens inside `render()` and routinely takes longer than `waitFor`'s
// default 1000ms budget -- failing deterministically. In the full suite it usually
// (not always) passes only because some other file happens to import overlapping
// modules around the same time, incidentally warming the shared transform cache before
// this test's `waitFor` polls -- an accidental ordering dependency, not a design.
//
// Importing the same lazy chunks here pays that one-time transform cost up front, in a
// hook with its own timeout budget, so `React.lazy`'s later `import()` during `render()`
// just resolves an already-cached module promise -- independent of what else is running.
beforeAll(async () => {
  await Promise.all([import('page/PageTemplate'), import('page/HomePage')]);
});

describe('ChoreTracker', () => {
  it('renders without errors', async () => {
    render(<App />);

    await waitFor(async () => {
      const h1 = screen.getByText('Chore Tracker');

      expect(h1).toBeInTheDocument();
    });
  });
});
