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
//
// This list mirrors the `React.lazy` chain reachable from `App.tsx`'s index (`/`) route
// -- it is hand-written, not derived from `App.tsx`, so it will not update itself. If a
// lazy route is added to, or reordered ahead of, that chain and this list isn't updated
// to match, the ordering-dependent failure this hook exists to prevent returns silently:
// this exact test, `App.test.tsx`, failing deterministically when run alone and
// intermittently in the full suite. That symptom is finding T113 -- search git history
// for "T113" for the full investigation.
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
