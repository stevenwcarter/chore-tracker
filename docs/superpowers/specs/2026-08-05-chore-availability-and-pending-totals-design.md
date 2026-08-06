# Chore availability windows, assignee filter, and pending totals (2026-08-05)

Two independent features, brainstormed together and shipped on one branch
(`feat/chore-availability-and-pending-totals`).

**Feature A — Chore Management assignee filter + yearly availability windows.**
Steve wants to mark chores as school-year-only ("study for the spelling test",
"ready for school in the morning") by setting a start and end *month/day* that
repeat every year — e.g. Sep 1 → Jun 15. He also wants to filter the Chore
Management list by assignee.

**Feature B — Pending amounts on the landing page.** Each kid's tile should show,
under their balance, the money they have earned but not yet been paid, regardless
of whether an admin has approved it yet.

The two features touch almost entirely disjoint files and can be implemented in
parallel. The only shared files are `site/src/types/chore.ts` and the GraphQL
query modules.

## Toolchain

| | Rust | Frontend (from `site/`) |
|---|---|---|
| build | `cargo build` | `yarn build` |
| test | `cargo test` | `CI=true yarn test` |
| lint | `cargo clippy --all-targets` | `yarn lint` |
| format | `rustfmt --edition 2024 <file>` | prettier via lint-staged |

**Verified baselines on the clean tree at `3806c3c`:** clippy exactly **10**
warnings; `cargo fmt --check` exactly **11** diffs; **77** Rust lib tests plus 2+2
integration and 2 doctests pass; **93** frontend tests across **14** files pass.

- **Never run bare `cargo fmt`** — the 11 pre-existing diffs must not be swept
  into a commit. Format only edited files, then `git diff --stat` to confirm.
- **Never pass `-D warnings`.** Add no new warnings; fix none of the baseline.
- The husky pre-commit hook runs `cd site && npx lint-staged && CI=true yarn test`.
  It runs the frontend suite only — it will not catch Rust breakage.
- `site/src/App.test.tsx` is known-flaky under CPU load. If only that fails,
  re-run before concluding regression.
- **Locate every symbol with `grep -n`. Do not trust line numbers quoted here.**

## Decisions taken during brainstorming

Steve chose each of these explicitly:

1. **Out-of-season rendering** — per-day, with the row hidden when the whole
   displayed week is out of season. Not whole-chore-by-today (that would
   retroactively corrupt the display of past weeks).
2. **Assignee filter UX** — a single-select chip row with kid profile photos,
   plus **All** and **Unassigned** chips.
3. **Partial-week weekly pay** — the per-day rate stays constant. A week cut
   short by the season simply pays less. **No proration.**

Decided by Claude and stated for the record:

4. Pending totals exclude `paid_out = true` completions. Once paid out the money
   has moved into the kid's YNAB balance; counting it in both places would double
   it and the pending figure would grow without bound.
5. Bonus chores get no availability window. They already carry an explicit
   `bonus_date` for a single day, so a yearly window is meaningless for them and
   `CreateBonusChoreForm` does not offer one.
6. The admin Chore Management list is never filtered by season — an admin must be
   able to see and edit summer chores in December.
7. Both availability columns are set or neither is. There is no half-open window.

---

# Feature A — Availability windows and assignee filter

## A1. Storage

Migration `add_chore_availability_window` adds two nullable columns to `chores`:

```sql
ALTER TABLE chores ADD COLUMN available_start INTEGER;
ALTER TABLE chores ADD COLUMN available_end INTEGER;
```

Both hold an **MMDD-encoded integer**, `month * 100 + day`: Sep 1 = `901`,
Jun 15 = `615`, Dec 31 = `1231`. Both NULL means "available year round", which is
every pre-existing row, so the migration needs no backfill.

The `down.sql` drops both columns. Test the migration in both directions
(`run` → `revert` → `run`) per CLAUDE.md, then regenerate `src/schema.rs` with
`diesel print-schema > src/schema.rs`.

MMDD was chosen over four separate month/day columns (16 null-combinations, 14 of
them illegal) and over `TEXT` `"09-01"` (stringly-typed, parse on every read). It
also mirrors the existing `required_days` bitmask idiom: one documented integer
encoding with a single helper module owning it.

## A2. Rust domain types

In `src/models.rs`, alongside `PaymentType`:

```rust
/// A day of the year with no year attached, encoded as `month * 100 + day`.
pub struct MonthDay(i32);
```

- `MonthDay::new(month: u32, day: u32) -> Result<Self>` validates `1..=12` and
  that the day is valid for that month. **Feb 29 is accepted** — a window
  boundary is a month/day comparison, not a real date, so `Feb 29` is a
  well-defined boundary even in a non-leap year (Feb 28 = `228` sorts before it,
  Mar 1 = `301` after). **Feb 30 and Apr 31 are rejected.**
- `MonthDay::from_mmdd(i32) -> Result<Self>` for the DB read path, revalidating.
- `MonthDay::from_date(NaiveDate) -> Self`.
- `month()`, `day()`, `as_mmdd()` accessors.

```rust
pub struct AvailabilityWindow { start: MonthDay, end: MonthDay }
```

- `AvailabilityWindow::from_columns(start: Option<i32>, end: Option<i32>) -> Result<Option<Self>>`
  returns `Ok(None)` when both are NULL, the window when both are set, and an
  error when exactly one is set (decision 7).
- `contains(&self, date: NaiveDate) -> bool`, **inclusive on both ends**:

  ```
  let d = MonthDay::from_date(date).as_mmdd();
  if start <= end { start <= d && d <= end }   // Mar 1 – Jun 15
  else            { d >= start || d <= end }   // Sep 1 – Jun 15, wraps New Year
  ```

  A window where `start == end` is a single day.

`Chore` gains `available_start: Option<i32>` and `available_end: Option<i32>`
fields to match the schema, plus a helper
`Chore::availability_window(&self) -> Result<Option<AvailabilityWindow>>`.

## A3. GraphQL surface

`Chore` gains a nullable object field:

```graphql
type AvailabilityWindow { startMonth: Int!, startDay: Int!, endMonth: Int!, endDay: Int! }
type Chore { ...  availabilityWindow: AvailabilityWindow }
input AvailabilityWindowInput { startMonth: Int!, startDay: Int!, endMonth: Int!, endDay: Int! }
input ChoreInput { ...  availabilityWindow: AvailabilityWindowInput }
```

Omitting `availabilityWindow` on input, or passing `null`, clears the window
(year-round). An input with an invalid month/day is rejected via
`graphql_translate_anyhow`, surfacing as a toast on the client.

`ChoreInput` currently has **11 struct literals** — `src/test_helpers.rs` (1),
`src/svc/chore.rs` (8) and `src/svc/chore_completion.rs` (2) — that must each
gain the new field. (`grep -n "ChoreInput {" src/` reports a 12th hit in
`src/models.rs`; that one is the struct definition itself.)

## A4. Server-side enforcement — the load-bearing seam

`ChoreCompletionSvc::create` already loads the chore inside a transaction and
calls `ensure_bonus_claim_allowed(&chore, conn)?`. Add a sibling immediately
after it:

```rust
ensure_within_availability_window(&chore, completion_input.completed_date)?;
```

which errors when the chore has a window and `completed_date` falls outside it.

**This is the enforcement point. The frontend gating in A5 is an affordance
only.** The server check must be tested directly against the service — never
through the UI — because the UI's correctness depends on it, not the reverse.

## A5. Kid-facing weekly view

New `site/src/utils/availabilityWindow.ts`, the single frontend owner of the
encoding (mirroring how `weekdayBitmask.ts` owns `requiredDays`):

- `isDateInWindow(window: AvailabilityWindow | null | undefined, date: Date): boolean`
  — a null/absent window is always available. Same wrap logic as A2.
- `formatWindow(window): string` → `"Sep 1 – Jun 15"`.

Changes:

- `GET_USER_CHORES` and `GET_ALL_CHORES` in `site/src/graphql/queries.ts` select
  `availabilityWindow { startMonth startDay endMonth endDay }`.
- `ChoreRow.renderChoreCell` ANDs the season into its existing scheduled test:
  `const isScheduled = isDayInBitmask(chore.requiredDays, date) && isDateInWindow(chore.availabilityWindow, date)`.
  Out-of-season cells then render the existing empty `<div className="w-8 h-8">`,
  identical to a non-scheduled weekday. Because `ChoreRow` backs **both** the
  desktop grid and the mobile card, this one change covers both layouts.
- `useUserChores` drops a chore from `weeklyChoreData` when no day of the
  displayed week is in its window:
  `getWeekDateRange(weekStartDate).dates.some((d) => isDateInWindow(w, d))`.
  Chores without a window are unaffected — the predicate is always true for them.

## A6. Chore Management screen

- New `site/src/components/ChoreAssigneeFilter.tsx`: a single-select chip row —
  **All**, one photo chip per user, **Unassigned**. Selected chip gets the
  `ring-4 ring-blue-500` treatment `UserSelector` already uses. Props:
  `users`, `value: 'all' | 'unassigned' | number`, `onChange`.
- `UserImage` gains an optional `size?: 'sm' | 'lg'` prop, defaulting to `'lg'`
  so **every existing call site renders byte-identically**; the filter uses
  `'sm'` (48px) so the chip row is not 80px tall.
- `AdminChoreManagement` holds the filter state and derives `visibleChores` in a
  `useMemo`. `'all'` passes everything; a user id keeps chores whose
  `assignedUsers` contains that id; `'unassigned'` keeps chores with an empty or
  absent `assignedUsers`. Filtering is client-side over the already-loaded list.
- When the filter yields nothing, render an empty-state message
  (`No chores assigned to Emma.` / `No unassigned chores.`) instead of a bare grid.
- `ChoreCard` gains an `Available:` row showing `formatWindow(...)`, rendered
  **only** when a window is set, so year-round cards are unchanged.

## A7. Create/Edit chore form

`CreateChoreForm` gains an "Availability" section:

- An off-by-default checkbox, `Only available part of the year`.
- When checked, reveals **Start** and **End**, each a month `<select>` plus a day
  `<select>` whose options recompute for the selected month (Feb offers 1–29).
- Submit sends `availabilityWindow: enabled ? {startMonth, startDay, endMonth, endDay} : null`.
- Edit mode initializes the checkbox and both pickers from
  `initialChore.availabilityWindow`.

Extract the month+day pair into `site/src/components/MonthDayPicker.tsx` rather
than growing `CreateChoreForm` (already 213 lines) by another ~70.

---

# Feature B — Pending amounts on the landing page

## B1. The two-number trap

The number under each kid's photo today comes from **YNAB, not this database**:
`UserSvc::balances` reads the "*<name>* Cash" category and returns **whole
dollars** as `f64`, matched to the kid **by name**. The pending figure comes from
the local `chore_completions` table in **cents** as `i32`, matched **by user id**.

`UserBalance` will therefore hold two values in different units keyed different
ways. Keep the two formatters distinct — the existing local dollars formatter for
the balance, `utils/dateUtils.formatCurrency` (which takes **cents**) for
pending — and comment the difference at the prop boundary.

## B2. Backend

New `ChoreCompletionSvc::get_pending_totals(context) -> Result<Vec<(User, i32)>>`:
join `chore_completions` to `users`, filter `paid_out = false`, group by user,
sum `amount_cents`. Approved and unapproved completions both count (that is the
whole point); paid-out ones do not (decision 4). A user with nothing pending
simply does not appear in the result — the client reads a missing entry as zero.

This is deliberately **not** a refactor of `get_unpaid_totals`. That query
carries a specific LEFT JOIN so users with nothing owed still appear on the
payout screen, and it feeds the money-moving path. Pending needs none of that, so
the payout code is left untouched.

New GraphQL type and query, mirroring `UnpaidTotal`:

```graphql
type PendingTotal { user: User!, amountCents: Int! }
type Query { getPendingTotals: [PendingTotal!]! }
```

## B3. Frontend

- `GET_PENDING_TOTALS` query in `site/src/hooks/queries.ts`, next to
  `LIST_BALANCES_GQL`.
- New `usePendingTotals` hook beside `useBalances`, with `pollInterval: 30_000`
  — matching what `useUserChores` already does for completions — so a kid who
  completes a chore sees the figure move without reloading. Errors toast once,
  same shape as `useBalances`.
- `UserBalance` gains `pendingCents?: number` and renders a second line
  `({formatCurrency(pendingCents)})` in `text-yellow-400`, echoing the yellow the
  app already uses for pending-approval completions. Renders nothing when the
  value is 0 or absent, so the tile is unchanged for a kid with nothing pending.
- `UserSelector` calls the hook and passes `pendingCents` per user, looked up
  **by `user.id`** while the balance continues to be looked up by `user.name`.

---

# Invariants this work depends on

Per the spec discipline in `~/.claude/CLAUDE.md` — every one of these gets a test
rather than a prose assurance.

1. **The wrap-aware `contains` predicate exists twice**, in Rust (`A2`) and in
   TypeScript (`A5`). Both implementations get the **same test table** —
   non-wrapping, wrapping, inclusive endpoints, single-day, and the year
   boundary — so changing one without the other fails a suite.
2. **The kid-facing UI gating is decorative; `ChoreCompletionSvc::create` is the
   enforcement.** The server rejection is tested directly at the service, not via
   a component test, because a future UI refactor must not be able to silently
   remove the guarantee.
3. **The weekly per-day rate is `amount_cents / popcount(required_days)` and the
   season never changes it** (decision 3). A characterization test pins this so a
   future proration change is a deliberate, visible break rather than a silent one.
4. **`UserImage`'s current rendering is 80px.** The new `size` prop defaults to
   the existing appearance; a test asserts the default call site is unchanged.
5. **Balances are dollars, pending is cents.** The `UserBalance` test asserts 200
   cents renders as `$2.00` — a test that fails loudly on a 100× unit mixup.
6. **`getUnpaidTotals` semantics are untouched by Feature B.** Its existing tests
   must still pass unmodified; if one needs editing, something went wrong.

# Test plan

**Rust**

- `MonthDay::new` table: valid dates, month 0/13 rejected, day 0 rejected,
  Feb 29 accepted, Feb 30 rejected, Apr 31 rejected.
- `AvailabilityWindow::contains` table: non-wrapping in/out, wrapping in/out,
  both endpoints inclusive, `start == end` single day, Dec 31 / Jan 1 across the
  wrap.
- `from_columns` both-or-neither, including the error case.
- Chore create/read round-trip persisting a window (guards migration + schema).
- `ChoreCompletionSvc::create` **rejects** an out-of-season `completed_date`,
  **accepts** an in-season one, and **accepts on both exact boundary days**.
- A chore with no window accepts any date (regression guard for existing chores).
- Weekly rate characterization test (invariant 3).
- `get_pending_totals`: unapproved counts, approved-unpaid counts, paid-out
  excluded, users isolated from each other, empty for a user with no completions.

**Frontend (vitest)**

- `availabilityWindow.test.ts` — the mirror of the Rust table, plus
  null-window-always-available and `formatWindow` output.
- `ChoreRow` — out-of-season day renders no complete button; in-season day does.
- `useUserChores` — chore hidden when the whole displayed week is out of season;
  visible on a boundary week where only some days qualify.
- `AdminChoreManagement` — filtering by a kid narrows the cards; `Unassigned`
  shows only unassigned chores; `All` restores the full list; empty state renders.
- `CreateChoreForm` — toggling the checkbox and submitting sends the right
  `availabilityWindow`; editing a windowed chore prefills both pickers; leaving
  it off sends `null`.
- `ChoreCard` — the `Available:` row appears only for a windowed chore.
- `UserBalance` — renders `($2.00)` for 200 pending cents, renders no pending
  line at 0, and leaves the balance line unaffected.

# Documentation

`CLAUDE.md` gains a short **Chore Availability Windows** note next to the
existing *Weekly Chore Payment Logic* section: the MMDD encoding, the wrap rule,
the both-or-neither constraint, and a pointer to this spec. Also note that
`getPendingTotals` is unpaid-regardless-of-approval while `getUnpaidTotals` is
approved-and-unpaid, since the near-identical names invite confusion.

# Out of scope

- Prorating weekly pay across a partial season week (decision 3).
- Availability windows on bonus chores (decision 5).
- Filtering the admin chore list by season (decision 6).
- Multi-select assignee filtering, or persisting the filter across reloads.
- Showing pending totals on the admin payout screen.
