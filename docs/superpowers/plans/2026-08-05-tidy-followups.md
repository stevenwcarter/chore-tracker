# Tidy Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the six tidy findings Steve selected on 2026-08-05 — one needless clone, one never-fetched GraphQL field, and four pieces of test hardening that convert invariants currently guarded only by prose into executable assertions.

**Architecture:** Six independent tasks committed directly to `main`, one commit each, each stripping its finding from `TIDY.md`. Only T104→T105 are ordered (T104 makes the field reachable that T105's test depends on). Most of the batch adds tests rather than changing behaviour.

**Tech Stack:** Rust 2024 / Juniper 0.17 / Diesel 2 (SQLite) · React 19 / TypeScript / Apollo Client 4 / Vitest 4 / Testing Library · yarn (never npm in `site/`)

## Global Constraints

- **Working directly on `main`** (Steve's choice). `main` is 33 commits ahead of `origin/main`. Do not push, do not merge, do not rebase.
- **Line numbers in `TIDY.md` are STALE** — recorded before 33 commits landed. `src/svc/chore_completion.rs` was restructured (the `ChoreCompletion` literal now lives in a `new_completion` helper). **Locate every symbol with `grep -n`; never trust a quoted line number.**
- **Never run bare `cargo fmt`.** The tree has exactly **11** pre-existing rustfmt diffs that must not be swept into a commit. Format only files you edited: `rustfmt --edition 2024 <file>`, then `git diff --stat` to confirm nothing unrelated moved. Revert any hunk rustfmt applies to drift you did not write.
- **Never pass `-D warnings` to clippy.** Baseline is exactly **10** warnings. Add none; fix none of the baseline. Confirm the count is still 10 when you finish.
- **Verified baselines at `408e812`:** clippy 10; `cargo fmt --check` 11 diffs; 76 Rust lib tests + 6 integration/doctests pass; 86 frontend tests across 13 files pass; `yarn lint` and both builds clean.
- **`site/build/` must exist before `cargo build`** — `rust-embed` embeds it. It exists; do not rebuild it unnecessarily.
- **The husky pre-commit hook IS active** and runs `cd site && npx lint-staged && CI=true yarn test`. It runs the FRONTEND suite only — it will not catch Rust breakage. Run `cargo test` yourself. Never pass `--no-verify`.
- **`site/src/App.test.tsx` is known-flaky** under CPU load; reproduces on an untouched tree. If only that fails, re-run before concluding regression.
- **`TIDY.md` is UNTRACKED** (`.git/info/exclude`). Strip each finding's block — from its `### T<n>.` heading through its `- [ ] execute   [ ] skip` line — by editing the working file. `git add TIDY.md` will FAIL. Record the removal in the commit body.
- Stage only files you changed. **Never `git add -A`.**
- Commit format: `tidy(<lens>): <summary> [T<n>]`.

---

## File Structure

**Modified:**
- `src/svc/chore_completion.rs` — drop a clone in `new_completion` (T103)
- `src/models.rs` — strengthen the batched-resolver cache test (T106)
- `src/graphql.rs` — add a subscription-root assertion test (T108)
- `src/api/graphql.rs` — comment recording why missing websocket coverage is tolerable (T108)
- `site/src/graphql/queries.ts` — add `approvedAt` to a selection set (T104)
- `site/src/components/CompletionCard.tsx` — gate the "Approved" line on `approved` (T105)
- `site/src/components/__tests__/AdminCompletionReview.test.tsx` — assert the line now renders (T104), and that a pending card suppresses it (T105)

**Created:**
- `site/src/hooks/__tests__/useCompletionLookup.test.ts` — exercise `isChoreCompletedByUser` (T107)

---

## Task 1: Drop the needless clone in `new_completion` (T103)

**Files:**
- Modify: `src/svc/chore_completion.rs` (in `fn new_completion`)

**Interfaces:**
- Consumes: `crate::uuid_or_generate(Option<String>) -> String`
- Produces: nothing downstream

The current code (locate with `grep -n 'fn new_completion' -A6 src/svc/chore_completion.rs`):

```rust
fn new_completion(input: &ChoreCompletionInput, amount_cents: i32) -> ChoreCompletion {
    ChoreCompletion {
        id: None,
        uuid: crate::uuid_or_generate(input.uuid.clone()),
```

**Important:** `input` is a `&ChoreCompletionInput` — a BORROW. `input.uuid` is an `Option<String>`, and `uuid_or_generate` takes it by value. **You therefore cannot simply delete `.clone()`** — you cannot move out of a borrow.

This makes T103 as written **not applicable in its current form**. The finding was recorded against an older shape of this code, where the struct literal was inline in `create` and owned its input.

- [ ] **Step 1: Confirm the borrow**

```bash
grep -n 'fn new_completion' -A6 src/svc/chore_completion.rs
grep -n 'fn uuid_or_generate' -A6 src/lib.rs
```

Confirm `input` is `&ChoreCompletionInput` and `uuid_or_generate` takes `Option<String>` by value.

- [ ] **Step 2: Verify by attempting the change**

Temporarily change the line to `uuid: crate::uuid_or_generate(input.uuid),` and run:

```bash
cargo build
```

Expected: `error[E0507]: cannot move out of ... which is behind a shared reference`.

Record the exact error text — it is the evidence that the finding is stale.

- [ ] **Step 3: Restore and STOP**

```bash
git checkout -- src/svc/chore_completion.rs
git diff --exit-code src/svc/chore_completion.rs
```

**Do NOT change `new_completion`'s signature to take the input by value.** That is a public-API-shaped change to a helper introduced by an earlier reviewed task, it would push the clone up to the caller rather than remove it, and the batch's disabled-categories rule forbids it.

- [ ] **Step 4: Convert T103 to a decision-needed marker in `TIDY.md`**

Per the batch's disabled-categories rule, a finding whose fix requires a signature change is not auto-applied. Edit T103's block in the working `TIDY.md`, replacing its `- Proposed fix:` line with:

```
- Proposed fix: **[decision needed — not auto-applied]** Stale finding. `new_completion(input: &ChoreCompletionInput, ...)` takes its input by reference (the struct literal was extracted from `create` by T16), so `input.uuid.clone()` cannot simply be dropped — `cargo build` reports `error[E0507]: cannot move out of ... behind a shared reference`. Removing the clone requires changing `new_completion` to take the input by value, which only moves the clone to the caller. The remaining options are: (a) accept the clone (one `Option<String>` per completion creation — negligible), or (b) have `new_completion` take `uuid: Option<String>` as a separate owned parameter. Recommend (a).
```

Leave its checkboxes as `- [ ] execute   [ ] skip` so it stays visible for a future pass.

- [ ] **Step 5: Commit the marker**

`TIDY.md` is untracked, so there is nothing to stage and **no commit to make** for this task. Report the outcome instead; the marker lives in the working file.

If `git status --porcelain` shows any modified tracked file after Step 3, something went wrong — investigate before continuing.

---

## Task 2: Fetch `approvedAt` in `GET_ALL_WEEKLY_COMPLETIONS` (T104)

**Files:**
- Modify: `site/src/graphql/queries.ts` (`GET_ALL_WEEKLY_COMPLETIONS`)
- Test: `site/src/components/__tests__/AdminCompletionReview.test.tsx`

**Interfaces:**
- Produces: `completion.approvedAt` becomes populated for completions delivered through this query — Task 3 depends on this.

The query currently selects `approved` but not `approvedAt`, so Apollo strips the field and `CompletionCard`'s `{completion.approvedAt && …}` line has never rendered.

- [ ] **Step 1: Write the failing test**

Add to `site/src/components/__tests__/AdminCompletionReview.test.tsx`. Follow the file's existing mock/fixture pattern — read it first and reuse its `MockedProvider` wrapper, its `GET_ALL_WEEKLY_COMPLETIONS` mock shape, and its approved-completion fixture rather than inventing new ones. Add `approvedAt` to that fixture and assert the line renders:

```tsx
it('renders the approval date on an approved completion', async () => {
  // extend the existing approved-completion fixture with:
  //   approvedAt: '2026-08-03T12:00:00'
  // and add `approvedAt` to the mock's selection-set result object.
  render(/* existing wrapper + AdminCompletionReview */);

  expect(await screen.findByText(/Approved:/)).toBeInTheDocument();
});
```

Match the exact fixture/mock names already in the file.

- [ ] **Step 2: Run to verify it fails**

```bash
cd site && CI=true yarn test src/components/__tests__/AdminCompletionReview.test.tsx
```

Expected: FAIL — `Unable to find an element with the text: /Approved:/`. The mock supplies `approvedAt`, but Apollo strips it because the document does not request it. That failure IS the bug.

- [ ] **Step 3: Add the field to the selection set**

In `site/src/graphql/queries.ts`, inside `GET_ALL_WEEKLY_COMPLETIONS`, add `approvedAt` immediately after `approved`:

```graphql
      completedDate
      approved
      approvedAt
      amountCents
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd site && CI=true yarn test src/components/__tests__/AdminCompletionReview.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Full frontend verification**

```bash
cd site && yarn lint && yarn build && CI=true yarn test
```

- [ ] **Step 6: Strip T104 from TIDY.md and commit**

Delete T104's block from the working `TIDY.md` (do not stage it).

```bash
cd /home/steve/src/chore-tracker
git add site/src/graphql/queries.ts site/src/components/__tests__/AdminCompletionReview.test.tsx
git commit -m "tidy(opportunistic): fetch approvedAt in GET_ALL_WEEKLY_COMPLETIONS [T104]

The query selected \`approved\` but not \`approvedAt\`, so Apollo stripped the
field and CompletionCard's \"Approved: <date>\" line had never rendered on the
admin review screen. Pre-existing; found during the 2026-08-04 batch.

Removes T104 from TIDY.md."
```

---

## Task 3: Gate the "Approved" line on `approved` (T105)

**Files:**
- Modify: `site/src/components/CompletionCard.tsx`
- Test: `site/src/components/__tests__/AdminCompletionReview.test.tsx`

**Interfaces:**
- Consumes: `approvedAt` now being fetched (Task 2)

**Must land after Task 2.**

`CompletionCard` renders the approval line for EVERY usage including pending cards, where the pre-refactor inline markup had none. It was unreachable via three invariants; Task 2 removed one.

Current code (`grep -n 'approvedAt' -B2 -A4 site/src/components/CompletionCard.tsx`):

```tsx
{completion.approvedAt && (
  <p className="text-xs text-gray-400">
    Approved: {new Date(completion.approvedAt).toLocaleDateString()}
  </p>
)}
```

- [ ] **Step 1: Write the failing test**

Add to `site/src/components/__tests__/AdminCompletionReview.test.tsx`, reusing the file's existing fixtures and wrapper:

```tsx
it('suppresses the approval date on a pending completion that carries one', async () => {
  // Use the existing PENDING completion fixture, but give it:
  //   approved: false,
  //   approvedAt: '2026-08-03T12:00:00'
  // (a combination the backend does not currently produce — that is the point)
  render(/* existing wrapper + AdminCompletionReview */);

  // The pending card must be on screen...
  expect(await screen.findByRole('button', { name: /Approve/ })).toBeInTheDocument();
  // ...and must NOT show an approval date.
  expect(screen.queryByText(/Approved:/)).not.toBeInTheDocument();
});
```

Note the first assertion is load-bearing: without it, `queryByText(...).not.toBeInTheDocument()` would pass vacuously if the card failed to render at all.

- [ ] **Step 2: Run to verify it fails**

```bash
cd site && CI=true yarn test src/components/__tests__/AdminCompletionReview.test.tsx
```

Expected: FAIL — the pending card renders "Approved: …" because the condition checks only `approvedAt`.

- [ ] **Step 3: Add the explicit gate**

```tsx
{completion.approved && completion.approvedAt && (
  <p className="text-xs text-gray-400">
    Approved: {new Date(completion.approvedAt).toLocaleDateString()}
  </p>
)}
```

Keep the `approvedAt` check so a null date still renders nothing.

- [ ] **Step 4: Run to verify both tests pass**

```bash
cd site && CI=true yarn test src/components/__tests__/AdminCompletionReview.test.tsx
```

Expected: PASS — both the new pending-suppression test AND Task 2's approved-renders test. If Task 2's test now fails, the gate is wrong.

- [ ] **Step 5: Full frontend verification**

```bash
cd site && yarn lint && yarn build && CI=true yarn test
```

- [ ] **Step 6: Strip T105 and commit**

```bash
cd /home/steve/src/chore-tracker
git add site/src/components/CompletionCard.tsx site/src/components/__tests__/AdminCompletionReview.test.tsx
git commit -m "tidy(opportunistic): gate CompletionCard's approval line on approved [T105]

The line was rendered for every usage including pending cards, where the
pre-refactor inline markup had none. It was unreachable only via three
invariants, one of which T104 removed. Now gated explicitly and pinned by a
test using a pending completion carrying an approvedAt -- a combination the
backend does not currently produce.

Removes T105 from TIDY.md."
```

---

## Task 4: Make the cache test distinguish correct keying from mis-keying (T106)

**Files:**
- Modify: `src/models.rs` (`batched_resolvers_return_the_same_values_as_before`)

**Interfaces:**
- Consumes: `cached_by_id(cache, id, fetch)` in `src/models.rs`; `test_db::{create_test_context, create_test_admin, create_test_user, create_test_chore, day_patterns}`

The current test uses ONE chore and ONE user across three completions, so a cache mis-keyed in a way that still resolves the same singleton row passes. The final whole-branch review flagged this as the highest-value cheap hardening available.

- [ ] **Step 1: Read the current test and its helper**

```bash
grep -n 'fn batched_resolvers_return_the_same_values_as_before' -A26 src/models.rs
grep -n 'fn create_completion_on_day' -A20 src/models.rs
```

Note `create_completion_on_day(&context, &chore, &user, i)` — you will need to vary chore AND user per completion.

- [ ] **Step 2: Strengthen the test**

Replace the test body so at least two distinct chores and two distinct users are interleaved, and each completion asserts it resolves ITS OWN chore and user:

```rust
    #[tokio::test]
    async fn batched_resolvers_return_the_same_values_as_before() {
        let context = test_db::create_test_context();
        let admin = test_db::create_test_admin(&context, "Parent", "p@example.com");

        let alice = test_db::create_test_user(&context, "Alice");
        let bob = test_db::create_test_user(&context, "Bob");
        let dishes = test_db::create_test_chore(
            &context,
            "Dishes",
            PaymentType::Daily,
            100,
            test_db::day_patterns::monday_only(),
            admin.id.unwrap(),
        );
        let trash = test_db::create_test_chore(
            &context,
            "Trash",
            PaymentType::Daily,
            250,
            test_db::day_patterns::monday_only(),
            admin.id.unwrap(),
        );

        // Interleave so a cache keyed on anything but the id resolves the wrong row.
        let expected = [
            (&dishes, &alice),
            (&trash, &bob),
            (&dishes, &bob),
            (&trash, &alice),
        ];

        let completions: Vec<_> = expected
            .iter()
            .enumerate()
            .map(|(i, (chore, user))| {
                create_completion_on_day(&context, chore, user, i as i64)
            })
            .collect();

        for (completion, (chore, user)) in completions.iter().zip(expected.iter()) {
            let resolved_chore = completion.chore(&context).await.unwrap();
            let resolved_user = completion.user(&context).await.unwrap();
            assert_eq!(
                resolved_chore.id, chore.id,
                "completion resolved the wrong chore -- cache mis-keyed?"
            );
            assert_eq!(
                resolved_chore.name, chore.name,
                "resolved chore name mismatch"
            );
            assert_eq!(
                resolved_user.id, user.id,
                "completion resolved the wrong user -- cache mis-keyed?"
            );
            assert_eq!(resolved_user.name, user.name, "resolved user name mismatch");
        }
    }
```

Adapt `create_completion_on_day`'s signature and the day offset type to whatever the helper actually takes — read it first. Mind the `max_size(1)` test pool: hold only one connection at a time.

- [ ] **Step 3: Run to verify it passes**

```bash
cargo test batched_resolvers_return_the_same_values_as_before
```

Expected: PASS against the correct implementation.

- [ ] **Step 4: Prove it bites**

Temporarily mis-key the cache in `src/models.rs::cached_by_id` — change the lookup and insert to use a constant instead of `id`:

```rust
    let hit = cache.lock()?.get(&0).cloned();
    // ...
    cache.lock()?.insert(0, value.clone());
```

Run:

```bash
cargo test batched_resolvers_return_the_same_values_as_before
```

Expected: **FAIL** with one of the "cache mis-keyed?" messages. Record the actual output.

Then restore exactly:

```bash
git checkout -- src/models.rs   # NOTE: this also reverts your Step 2 edit
```

**Careful:** `git checkout --` reverts the whole file, including your strengthened test. Instead, revert only the `cached_by_id` hunk by hand, then confirm:

```bash
grep -n 'fn cached_by_id' -A14 src/models.rs   # confirm it keys on `id` again
cargo test batched_resolvers_return_the_same_values_as_before   # PASS again
```

- [ ] **Step 5: Verify and commit**

```bash
cargo test && cargo clippy --all-targets 2>&1 | grep -c '^warning:'   # expect 10
rustfmt --edition 2024 src/models.rs
git diff --stat   # confirm ONLY src/models.rs changed
```

Strip T106 from the working `TIDY.md`, then:

```bash
git add src/models.rs
git commit -m "tidy(opportunistic): make the cache test detect a mis-keyed cache [T106]

The test used one chore and one user across three completions, so a cache
mis-keyed in a way that still resolved the same singleton row would pass. It
now interleaves two chores and two users and asserts each completion resolves
its own. Verified to fail when cached_by_id is keyed on a constant.

Removes T106 from TIDY.md."
```

---

## Task 5: Exercise `isChoreCompletedByUser` (T107)

**Files:**
- Create: `site/src/hooks/__tests__/useCompletionLookup.test.ts`

**Interfaces:**
- Consumes: `useCompletionLookup(allCompletionsData?) => { isChoreCompletedByAnyone, isChoreCompletedByUser }` from `site/src/hooks/useCompletionLookup.ts`

The predicate is only called from `BonusChoreSection`, and every existing fixture mocks `listBonusChores: []`, so the component early-returns before reaching it. It was moved byte-identical during T7 and is not suspect — but it is entirely unguarded.

**Test the hook directly rather than driving `BonusChoreSection`.** The hook takes a plain data object and needs no Apollo provider, so a direct `renderHook` test pins the predicate precisely and cheaply. (`BonusChoreSection` integration coverage would additionally prove the wiring, but that is a broader change than this finding asks for.)

- [ ] **Step 1: Write the test**

Create `site/src/hooks/__tests__/useCompletionLookup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCompletionLookup } from '../useCompletionLookup';

// 2026-08-03 is a Monday. Constructed in local time to match
// formatDateForGraphQL, which is deliberately local-time based.
const MONDAY = new Date(2026, 7, 3);
const TUESDAY = new Date(2026, 7, 4);

const data = {
  getAllWeeklyCompletions: [
    { choreId: 1, userId: 10, completedDate: '2026-08-03' },
    { choreId: 2, userId: 20, completedDate: '2026-08-03' },
  ],
} as never;

describe('useCompletionLookup', () => {
  it('reports a chore the given user completed on the given day', () => {
    const { result } = renderHook(() => useCompletionLookup(data));
    expect(result.current.isChoreCompletedByUser(1, 10, MONDAY)).toBe(true);
  });

  it('does not report a chore completed by a DIFFERENT user', () => {
    const { result } = renderHook(() => useCompletionLookup(data));
    expect(result.current.isChoreCompletedByUser(1, 20, MONDAY)).toBe(false);
  });

  it('does not report a DIFFERENT chore completed by the same user', () => {
    const { result } = renderHook(() => useCompletionLookup(data));
    expect(result.current.isChoreCompletedByUser(2, 10, MONDAY)).toBe(false);
  });

  it('does not report the same chore and user on a different day', () => {
    const { result } = renderHook(() => useCompletionLookup(data));
    expect(result.current.isChoreCompletedByUser(1, 10, TUESDAY)).toBe(false);
  });

  it('returns false when there is no completion data at all', () => {
    const { result } = renderHook(() => useCompletionLookup(undefined));
    expect(result.current.isChoreCompletedByUser(1, 10, MONDAY)).toBe(false);
  });
});
```

The three negative cases matter individually: each varies exactly one of the predicate's three inputs, so together they prove all three are actually consulted. A test asserting only the positive case would pass against a predicate that ignored `userId` entirely.

If the `as never` cast is rejected by lint, type the fixture against the real `ChoreCompletion` shape instead — read `site/src/types/chore.ts` and supply the required fields.

- [ ] **Step 2: Run to verify it passes**

```bash
cd site && CI=true yarn test src/hooks/__tests__/useCompletionLookup.test.ts
```

Expected: PASS, 5 tests. These are characterization tests over unchanged code — they must be green immediately. If any fails, you have found a real bug: stop and report rather than adjusting the test.

- [ ] **Step 3: Full frontend verification**

```bash
cd site && yarn lint && yarn build && CI=true yarn test
```

- [ ] **Step 4: Strip T107 and commit**

```bash
cd /home/steve/src/chore-tracker
git add site/src/hooks/__tests__/useCompletionLookup.test.ts
git commit -m "tidy(opportunistic): exercise isChoreCompletedByUser [T107]

The predicate is only reached via BonusChoreSection, and every existing
fixture mocks listBonusChores: [], so nothing exercised it. Adds direct hook
tests covering the positive case plus one negative per input (wrong user,
wrong chore, wrong day), so all three inputs are proven to be consulted.

Moved byte-identical during T7 -- tested as-is, not optimised.

Removes T107 from TIDY.md."
```

---

## Task 6: Pin that subscriptions are still empty (T108)

**Files:**
- Modify: `src/graphql.rs` (add a test)
- Modify: `src/api/graphql.rs` (add a comment at `custom_subscriptions`)

**Interfaces:**
- Consumes: `pub type Schema = RootNode<Query, Mutation, EmptySubscription<GraphQLContext>>` and `fn schema()` in `src/graphql.rs`

The repo has HTTP-level test coverage but nothing websocket-capable. A latent cache-sharing bug in `custom_subscriptions` shipped unnoticed until a whole-branch review caught it by inspection. The current safety rests entirely on nothing being resolvable over the socket — an invariant recorded only in prose.

**This task does NOT build a websocket harness** and does NOT change `EmptySubscription`. It converts the invariant into an assertion.

- [ ] **Step 1: Add the type-level assertion test**

In `src/graphql.rs`, add (or extend) a `#[cfg(test)] mod tests` with:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    /// Guards the invariant the untested websocket path depends on.
    ///
    /// `custom_subscriptions` has no test coverage — the repo has no
    /// websocket harness. That is tolerable only because nothing is
    /// resolvable over the socket. This function only type-checks while the
    /// schema's subscription root is `EmptySubscription`, so adding a real
    /// subscription breaks the build here and forces whoever does it to
    /// confront the missing coverage first.
    #[test]
    fn subscription_root_is_still_empty() {
        fn assert_empty_subscription_root(
            _: &RootNode<Query, Mutation, EmptySubscription<GraphQLContext>>,
        ) {
        }

        let schema = schema();
        assert_empty_subscription_root(&schema);
    }
}
```

Check whether `src/graphql.rs` already has a `#[cfg(test)] mod tests` — if so, add the test into it rather than declaring a second one. Also confirm the exact name of the schema constructor (`grep -n 'fn schema' src/graphql.rs`) and that `RootNode`, `EmptySubscription`, `Query`, `Mutation`, `GraphQLContext` are all in scope via the existing imports; add `use` lines inside the test module only if needed.

- [ ] **Step 2: Run to verify it passes**

```bash
cargo test subscription_root_is_still_empty
```

Expected: PASS.

- [ ] **Step 3: Verify it would actually fail on a real subscription**

Confirm by inspection and record your reasoning in the report: the helper's parameter type names `EmptySubscription<GraphQLContext>` explicitly, so if `pub type Schema` were changed to use any other subscription root, `assert_empty_subscription_root(&schema)` would not type-check and `cargo build` would fail.

If you want stronger evidence, temporarily change the helper's parameter to a different third type parameter, confirm the compile error, then restore and confirm with `git diff --exit-code src/graphql.rs`. Report whichever you did.

- [ ] **Step 4: Add the explanatory comment at the handler**

In `src/api/graphql.rs`, immediately above `async fn custom_subscriptions`, add:

```rust
// No test coverage: the repo has no websocket harness. This is tolerable only
// because the schema's subscription root is `EmptySubscription`, so nothing is
// resolvable here — an invariant pinned by `graphql::tests::subscription_root_is_still_empty`.
// Before adding a real subscription, add a harness that exercises this handler;
// a prior cache-sharing bug here was caught only by manual inspection.
```

- [ ] **Step 5: Verify and commit**

```bash
cargo test && cargo clippy --all-targets 2>&1 | grep -c '^warning:'   # expect 10
rustfmt --edition 2024 src/graphql.rs src/api/graphql.rs
git diff --stat   # confirm only those two files
```

Strip T108 from the working `TIDY.md`, then:

```bash
git add src/graphql.rs src/api/graphql.rs
git commit -m "tidy(opportunistic): pin that the subscription root stays empty [T108]

custom_subscriptions has no test coverage -- there is no websocket harness --
and that is tolerable only because nothing is resolvable over the socket. That
invariant lived only in prose; a latent cache-sharing bug in this handler was
caught by inspection alone. It is now a compile-time assertion: adding a real
subscription breaks the build and forces the harness question first.

Does not build a harness and does not change EmptySubscription.

Removes T108 from TIDY.md."
```

---

## Final verification

- [ ] **Both stacks green**

```bash
cd /home/steve/src/chore-tracker
cargo build && cargo test && cargo clippy --all-targets 2>&1 | grep -c '^warning:'
cargo fmt -- --check 2>&1 | grep -c '^Diff in'
cd site && yarn lint && yarn build && CI=true yarn test
```

Expected: builds and tests green; clippy exactly **10**; fmt drift exactly **11**.

- [ ] **TIDY.md accounting**

```bash
grep -cE '^### T[0-9]+\.' TIDY.md          # expect 89 (94 minus 5 stripped)
grep -E '^### T(104|105|106|107|108)\.' TIDY.md || echo "all five stripped"
grep -A4 '^### T103\.' TIDY.md             # must remain, with the decision-needed marker
grep -c '\[x\] skip' TIDY.md               # expect 1 (T15)
```

**Note the expected count is 89, not 88** — T103 is NOT stripped, because Task 1 converts it to a decision-needed marker rather than fixing it.

- [ ] **Report to Steve:** the commits made, T103's outcome and why, and the final counts.

## Out of scope

- `T93` (module-level `uuid_or_generate` import) — unselected; Task 1 must not pull it in.
- Building a websocket test harness — see Task 6.
- Optimising `isChoreCompletedByUser` — see Task 5.
- `BonusChoreSection` integration coverage — Task 5 tests the hook directly.
- The 11 pre-existing `cargo fmt` diffs.
- All other findings in `TIDY.md`, including `T15` which stays `[x] skip`.
