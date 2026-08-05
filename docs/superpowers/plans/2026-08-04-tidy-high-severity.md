# Tidy High-Severity Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 14 high-severity findings Steve selected from the 2026-08-04 `/tidy` triage — four confirmed bugs, four backend restructurings, one frontend utility cleanup, and five React component extractions — plus wire up the dormant husky pre-commit hook.

**Architecture:** Work proceeds in five ordered groups on branch `tidy/2026-08-04`. Group 0 makes the pre-commit hook functional so every later commit is gated. Group A fixes user-visible bugs (including a data migration). Group B restructures Rust services. Group C is a small frontend utility change. Group D extracts five oversized React components, each preceded by characterization tests that pin current rendered behaviour.

**Tech Stack:** Rust 2024 / Axum 0.8 / Juniper 0.17 / Diesel 2 (SQLite) · React 19 / TypeScript / Apollo Client 4 / Vite 8 / Vitest 4 / Testing Library · yarn (never npm in `site/`)

## Global Constraints

- **Branch:** `tidy/2026-08-04`. Do not merge or push; Steve integrates.
- **Line numbers in `TIDY.md` and the spec are STALE.** They were recorded at `b59bb45`, before the doc-comment commit `7569caf` inserted doc comments throughout. `src/models.rs` alone shifted ~17 lines (the `notes` resolver moved from `:492` to `:509`). **Always locate code by symbol name, never by the line number quoted in a finding.** Verify with `grep -n` before editing.
- **`site/build/` must exist before any `cargo build`** — `rust-embed` embeds it and the Rust build fails outright without it. If absent: `cd site && yarn install && yarn build`.
- **Never run bare `cargo fmt`.** The tree is not rustfmt-clean at `HEAD`: 13 pre-existing diffs across `src/auth.rs` (333, 375), `src/main.rs` (26), `src/models.rs` (247), `src/svc/admin.rs` (1), `src/svc/badge.rs` (102, 175, 182, 232, 266), `src/svc/chore.rs` (611), `src/test_helpers.rs` (40), `tests/upgrade_jsonwebtoken.rs` (41). A repo-wide `cargo fmt` sweeps all of these into your commit and destroys its revertability. Format only files you edited: `rustfmt --edition 2024 <file>`, then `git diff --stat` to confirm nothing unrelated moved. This drift is **out of scope** — leave it.
- **Never pass `-D warnings` to clippy.** `cargo clippy --all-targets` exits 0 with a known baseline: 2× `result_large_err` (`src/auth.rs`), 1× `str_to_string`, 4× `field_reassign_with_default`, 1× items-after-test-module (`src/svc/chore_completion.rs`, all inside `#[cfg(test)]`), plus `src/db.rs` and the `src/lib.rs` lint attributes. Introduce no *new* warnings; do not fix the baseline.
- **`site/src/App.test.tsx` is flaky** — intermittent `waitFor` timeout under CPU contention, reproduces on an untouched tree at `b59bb45`. If it goes red, re-run it alone on a quiet machine before concluding regression. Expected state: 15/15 pass.
- **Never use `--no-verify`.**
- **Commit format:** `tidy(<lens>): <summary> [T<n>]`. Characterization-test commits: `test: characterize <unit> before tidy [T<n>]`.
- **Strip the finding from `TIDY.md` in the same commit that fixes it.** `TIDY.md` is listed in `.git/info/exclude` and is therefore **untracked** — `git add TIDY.md` will not work and must not be attempted. "Strip" means: delete the `### T<n>. …` block through its `- [ ] execute   [ ] skip` line from the working file, and record the removal in the commit body (e.g. `Removes T14 from TIDY.md.`).
- **Verification commands.** Rust: `cargo build`, `cargo clippy --all-targets`, `cargo test`. Frontend (from `site/`): `yarn build`, `yarn lint`, `CI=true yarn test`.
- **Disabled categories:** renames and public-API signature changes are never auto-applied. If a task's fix would require one, stop, convert the item to a `decision-needed` marker in `TIDY.md`, and skip it.

---

## File Structure

**Created:**
- `site/src/utils/weekdayBitmask.ts` — single source of truth for the Monday-first weekday bitmask (T6)
- `site/src/utils/__tests__/weekdayBitmask.test.ts` — round-trip and convention tests (T6)
- `migrations/<timestamp>_fix_required_days_bitmask/{up,down}.sql` — rotate stored masks (T6)
- `site/src/hooks/useUserImages.ts` — image upload/remove, replacing raw `fetch` in a component (T1)
- `site/src/hooks/useCompletionActions.ts` — the three completion mutations (T4)
- `site/src/hooks/useIsMobile.ts` — viewport breakpoint hook (T7)
- `site/src/hooks/useCompletionLookup.ts` — completion lookup memo + predicates (T7)
- `site/src/components/AdminChoreToolbar.tsx`, `ChoreAssignmentModal.tsx`, `UserManagementModal.tsx` (T1)
- `site/src/components/CompletionSummary.tsx`, `CompletionNotesList.tsx`, `AddNoteForm.tsx` (T4)
- `site/src/components/PayoutSummaryCards.tsx`, `PayoutUserRow.tsx`, `PayoutActionsPanel.tsx` (T3)
- `site/src/components/BadgeChips.tsx`, `ChoreGrid.tsx`, `ChoreCardList.tsx` (T7)
- Characterization test files under `site/src/components/__tests__/` (T1, T2, T3, T4, T7)

**Modified:**
- `package.json` (root) — husky wiring (Task 0)
- `site/.lintstagedrc.json` — cover `.tsx` (Task 0)
- `site/src/graphql/queries.ts` — `CREATE_BONUS_CHORE` argument (T8)
- `site/src/hooks/useBonusChores.ts` — variables key + `paymentType` type (T8/T5)
- `site/src/components/CreateBonusChoreForm.tsx` — variables key + enum value (T8/T5)
- `src/models.rs` — `notes` / `admin_notes` visibility (T14); batch-loaded field resolvers (T13)
- `src/context.rs` — per-request memo caches (T13)
- `src/auth.rs` — `ADMIN_SESSION_COOKIE`, `admin_id_from_jar` (T10)
- `src/api/graphql.rs`, `src/api/images.rs` — use the shared helper (T10)
- `src/svc/chore_completion.rs` — single-connection transactional `create` (T16)
- `src/svc/chore.rs` — `can_claim_bonus` takes `&Chore` (T16)
- `src/svc/user.rs` — extracted YNAB config + table-driven kids (T17)
- `site/src/utils/dateUtils.ts` — TSDoc + unexport three helpers (T9)
- `site/src/components/CreateChoreForm.tsx`, `ChoreRow.tsx` — use `weekdayBitmask` (T6)
- The five oversized components (T1, T2, T3, T4, T7)

---

## Group 0 — Make the pre-commit hook real

### Task 0: Wire up husky so commits are actually gated

**Files:**
- Modify: `package.json` (root, verify only)
- Modify: `site/.lintstagedrc.json`
- Create: `.husky/_/` (generated by husky, not hand-written)

**Interfaces:**
- Consumes: nothing
- Produces: a functioning `pre-commit` hook that runs `cd site && npx lint-staged && CI=true yarn test` on every subsequent commit in this plan

**Why first:** `.husky/pre-commit` exists and is correct, but `husky install` was never run in this clone — there is no `.husky/_`, `core.hooksPath` is unset, and `.git/hooks/pre-commit` does not exist. Root `node_modules/` is absent, so the `prepare: husky` script never fired. Until this is fixed, **commits run no tests and no linting**.

- [ ] **Step 1: Confirm the hook is currently dormant**

```bash
git config --get core.hooksPath || echo "(unset)"
ls -a .husky
ls .husky/_ 2>&1 || echo "(no husky/_ — hook is dormant)"
```

Expected: `(unset)`, `.husky` contains only `pre-commit`, and `(no husky/_ …)`.

- [ ] **Step 2: Install root dev dependencies, which fires `prepare: husky`**

Root `package.json` already declares `"prepare": "husky"` with `husky ^9.0.11` and `lint-staged ^15.2.4`. Installing at the repo root is all that is needed:

```bash
cd /home/steve/src/chore-tracker && yarn install
```

- [ ] **Step 3: Verify the hook is now wired**

```bash
git config --get core.hooksPath   # expect: .husky/_
ls .husky/_/pre-commit            # expect: exists
```

If `core.hooksPath` is still unset, run `npx husky` directly and re-check.

- [ ] **Step 4: Close the `.tsx` gap in lint-staged**

`site/.lintstagedrc.json` currently reads:

```json
{
  "*.ts": ["eslint --fix"],
  "*.html": ["prettier --write"]
}
```

`*.ts` does **not** match `*.tsx`, so every React component — the bulk of this codebase and of this plan — is skipped by the hook. Replace with:

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{css,html,json,md}": ["prettier --write"]
}
```

> **Judgment call, easy to drop:** widening beyond `*.ts` is not strictly "add the husky hook". It is included because a hook that silently skips `.tsx` gives false assurance for Groups C and D. If Steve prefers the minimal change, keep the original two lines and note that `.tsx` is unlinted.

- [ ] **Step 5: Prove the hook actually fires**

```bash
cd /home/steve/src/chore-tracker
git add site/.lintstagedrc.json
git commit -m "build: wire up husky pre-commit hook and cover .tsx in lint-staged"
```

Expected: the commit output shows lint-staged running and the vitest suite executing (15 tests). If the hook does not visibly run, it is still dormant — stop and diagnose before continuing; every later task depends on this gate.

Note: root `node_modules/` is matched by the existing `node_modules` entry in `.gitignore`, so nothing extra needs ignoring. Do not commit a root lockfile change unless `yarn install` produced one; if it did, include it in this commit.

---

## Group A — Confirmed bugs

### Task 1: Fix bonus-chore creation end-to-end (T8 + T5)

**Files:**
- Modify: `site/src/graphql/queries.ts` (`CREATE_BONUS_CHORE`)
- Modify: `site/src/hooks/useBonusChores.ts`
- Modify: `site/src/components/CreateBonusChoreForm.tsx`
- Test: `site/src/hooks/__tests__/useBonusChores.test.tsx` (extend existing file)

**Interfaces:**
- Consumes: nothing
- Produces: `CREATE_BONUS_CHORE` whose variable is `$chore` (not `$input`); `CreateBonusChoreInput.paymentType` typed as `PaymentType`

**Why merged:** bonus-chore creation is rejected for *two* independent reasons. Fixing either alone leaves the feature broken, so they share one verification and one commit.

- [ ] **Step 1: Confirm both defects on the current tree**

```bash
grep -n 'CreateBonusChore' -A3 site/src/graphql/queries.ts
grep -n 'create_bonus_chore' -A4 src/graphql.rs
grep -n "paymentType" site/src/components/CreateBonusChoreForm.tsx
```

Expected: the document declares `$input: ChoreInput!` / `createBonusChore(input: $input)`; the resolver declares `chore: ChoreInput`; the form sends `paymentType: 'daily'`.

- [ ] **Step 2: Write the failing test**

Append to `site/src/hooks/__tests__/useBonusChores.test.tsx`. This asserts the mutation document uses the argument name the server actually exposes, and that a `DAILY` enum value round-trips. `MockedProvider` matches on the exact document and variables, so a mismatch fails the test — which is precisely the production failure mode.

```tsx
import { CREATE_BONUS_CHORE } from 'graphql/queries';
import { PaymentType } from 'types/chore';
import { print } from 'graphql';

describe('CREATE_BONUS_CHORE contract', () => {
  it('names its argument `chore`, matching Mutation::create_bonus_chore', () => {
    const doc = print(CREATE_BONUS_CHORE);
    expect(doc).toContain('$chore: ChoreInput!');
    expect(doc).toContain('createBonusChore(chore: $chore)');
    expect(doc).not.toContain('$input');
  });

  it('creates a bonus chore with the DAILY enum value', async () => {
    const chore = {
      uuid: null,
      name: 'Sweep the porch',
      description: null,
      paymentType: PaymentType.Daily,
      amountCents: 250,
      requiredDays: 0,
      active: true,
      createdByAdminId: 1,
      bonusDate: TODAY,
      maxClaims: 2,
    };

    const mocks: MockedResponse[] = [
      {
        request: { query: CREATE_BONUS_CHORE, variables: { chore } },
        result: {
          data: {
            createBonusChore: {
              id: 7,
              uuid: 'bonus-7',
              name: 'Sweep the porch',
              bonusDate: TODAY,
              maxClaims: 2,
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useBonusChores(TODAY), { wrapper: wrapper(mocks) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.createBonusChore(chore);

    await waitFor(() => expect(toast.error).not.toHaveBeenCalled());
  });
});
```

If `useBonusChores` does not currently expose a `createBonusChore` function with this shape, read the hook first and adapt the call to its real API — do **not** change the hook's public surface to suit the test (that would be a disabled public-API change).

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd site && CI=true yarn test src/hooks/__tests__/useBonusChores.test.tsx
```

Expected: FAIL — the `$chore` assertions fail against the current `$input` document, and the mutation mock does not match.

- [ ] **Step 4: Fix the mutation document**

In `site/src/graphql/queries.ts`, change `CREATE_BONUS_CHORE`:

```ts
export const CREATE_BONUS_CHORE = gql`
  mutation CreateBonusChore($chore: ChoreInput!) {
    createBonusChore(chore: $chore) {
      id
      uuid
      name
      bonusDate
      maxClaims
    }
  }
`;
```

- [ ] **Step 5: Update both callers' variables key**

In `site/src/hooks/useBonusChores.ts` and `site/src/components/CreateBonusChoreForm.tsx`, change every `variables: { input: … }` for this mutation to `variables: { chore: … }`. Locate them with:

```bash
grep -n 'input:' site/src/hooks/useBonusChores.ts site/src/components/CreateBonusChoreForm.tsx
```

- [ ] **Step 6: Fix the enum value and tighten its type**

In `site/src/components/CreateBonusChoreForm.tsx`, import the enum and use it:

```tsx
import { PaymentType } from 'types/chore';
// …
paymentType: PaymentType.Daily,
```

In `site/src/hooks/useBonusChores.ts`, change the interface field so the compiler catches this class of mistake:

```ts
import { PaymentType } from 'types/chore';

export interface CreateBonusChoreInput {
  // …
  paymentType: PaymentType;
  // …
}
```

- [ ] **Step 7: Run the tests and the build**

```bash
cd site && CI=true yarn test src/hooks/__tests__/useBonusChores.test.tsx && yarn lint && yarn build
```

Expected: PASS, lint clean, build succeeds (`tsc` proves the `PaymentType` tightening type-checks at both call sites).

- [ ] **Step 8: Strip T5 and T8 from TIDY.md and commit**

Delete the `### T5.` and `### T8.` blocks (each through its `- [ ] execute   [ ] skip` line) from `TIDY.md`. Remember `TIDY.md` is untracked — edit it, do not stage it.

```bash
cd /home/steve/src/chore-tracker
git add site/src/graphql/queries.ts site/src/hooks/useBonusChores.ts \
        site/src/components/CreateBonusChoreForm.tsx \
        site/src/hooks/__tests__/useBonusChores.test.tsx
git commit -m "tidy(opportunistic): fix bonus-chore mutation argument and enum value [T8][T5]

The CREATE_BONUS_CHORE document sent createBonusChore(input:) while the
Juniper resolver declares the argument as \`chore\`, and the form sent the
lowercase 'daily' where the GraphQL enum value is DAILY. Bonus-chore
creation failed schema validation for both reasons; neither fix works
alone. CreateBonusChoreInput.paymentType is now typed PaymentType so the
compiler catches recurrence.

Removes T5 and T8 from TIDY.md."
```

---

### Task 2: Stop leaking admin-only notes to unauthenticated clients (T14)

**Files:**
- Modify: `src/models.rs` (`ChoreCompletion::notes`, `ChoreCompletion::admin_notes`)
- Test: `src/models.rs` `#[cfg(test)] mod tests` (or the nearest existing Rust test module for completions)

**Interfaces:**
- Consumes: `ChoreCompletionNoteSvc::list_for_completion(context, completion_id, visible_to_user_only: bool)`; `GraphQLContext.admin_id: Option<i32>`
- Produces: note visibility gated on `context.admin_id`

**Security finding.** The `notes` resolver passes `visible_to_user_only = false`, so notes an admin marked non-user-visible are serialised to unauthenticated kid clients and hidden only in the browser.

- [ ] **Step 1: Locate the resolvers by symbol (line numbers are stale)**

```bash
grep -n 'pub async fn notes' -A12 src/models.rs
grep -n 'pub async fn admin_notes' -A12 src/models.rs
```

- [ ] **Step 2: Write the failing characterization tests**

Add to the completions test module. These use the existing helpers in `src/test_helpers.rs`.

```rust
#[test]
fn notes_hide_admin_only_entries_from_unauthenticated_requests() {
    let context = test_db::create_test_context(); // admin_id: None
    let admin = test_db::create_test_admin(&context, "Parent", "parent@example.com");
    let user = test_db::create_test_user(&context, "Kid");
    let chore = test_db::create_test_chore(
        &context, "Dishes", PaymentType::Daily, 100,
        test_db::day_patterns::monday_only(), admin.id.unwrap(),
    );

    let completion = create_completion_for_test(&context, chore.id.unwrap(), user.id.unwrap());
    add_note(&context, completion.id.unwrap(), "visible to kid", true);
    add_note(&context, completion.id.unwrap(), "admin eyes only", false);

    let notes = ChoreCompletionNoteSvc::list_for_completion(
        &context,
        completion.id.unwrap(),
        context.admin_id.is_none(),
    )
    .unwrap();

    assert_eq!(notes.len(), 1, "unauthenticated request must not receive admin-only notes");
    assert_eq!(notes[0].note_text, "visible to kid");
}

#[test]
fn notes_include_admin_only_entries_for_admin_requests() {
    let mut context = test_db::create_test_context();
    let admin = test_db::create_test_admin(&context, "Parent", "parent@example.com");
    context.admin_id = Some(admin.id.unwrap());

    let user = test_db::create_test_user(&context, "Kid");
    let chore = test_db::create_test_chore(
        &context, "Dishes", PaymentType::Daily, 100,
        test_db::day_patterns::monday_only(), admin.id.unwrap(),
    );

    let completion = create_completion_for_test(&context, chore.id.unwrap(), user.id.unwrap());
    add_note(&context, completion.id.unwrap(), "visible to kid", true);
    add_note(&context, completion.id.unwrap(), "admin eyes only", false);

    let notes = ChoreCompletionNoteSvc::list_for_completion(
        &context,
        completion.id.unwrap(),
        context.admin_id.is_none(),
    )
    .unwrap();

    assert_eq!(notes.len(), 2, "admin request must still receive every note");
}
```

`create_completion_for_test` and `add_note` are local helpers — write them in the same test module using `ChoreCompletionSvc::create` and `ChoreCompletionNoteSvc::create` with the real input structs. Read those two service signatures first and match them exactly.

- [ ] **Step 3: Run to verify the first test fails**

```bash
cargo test notes_hide_admin_only_entries -- --nocapture
```

Expected: FAIL, asserting 2 notes where 1 was required — this is the leak, reproduced.

- [ ] **Step 4: Commit the characterization tests**

```bash
git add src/models.rs
git commit -m "test: characterize note visibility before tidy [T14]"
```

- [ ] **Step 5: Gate the resolver on admin status**

In `ChoreCompletion::notes`, replace the hard-coded `false` third argument:

```rust
Ok(ChoreCompletionNoteSvc::list_for_completion(
    context,
    self.id.ok_or_else(|| {
        juniper::FieldError::new("ChoreCompletion has no id", juniper::Value::null())
    })?,
    context.admin_id.is_none(),
)?)
```

In `ChoreCompletion::admin_notes`, add the authorization gate as the first statement of the body:

```rust
context.require_admin()?;
```

- [ ] **Step 6: Run the full Rust suite**

```bash
cargo test && cargo clippy --all-targets
```

Expected: both new tests pass; no new clippy warnings beyond the documented baseline.

- [ ] **Step 7: Format only the touched file, strip T14, and commit**

```bash
rustfmt --edition 2024 src/models.rs
git diff --stat   # confirm ONLY src/models.rs changed
git add src/models.rs
git commit -m "tidy(opportunistic): gate completion notes on admin session [T14]

The notes resolver passed visible_to_user_only=false unconditionally, so
notes flagged admin-only were serialised to unauthenticated kid clients
and hidden only in the browser. Visibility now follows
context.admin_id, and admin_notes requires an admin session.

Removes T14 from TIDY.md."
```

---

### Task 3: Unify the weekday bitmask on Monday-first and migrate stored rows (T6)

**Files:**
- Create: `site/src/utils/weekdayBitmask.ts`
- Create: `site/src/utils/__tests__/weekdayBitmask.test.ts`
- Create: `migrations/<timestamp>_fix_required_days_bitmask/up.sql`, `down.sql`
- Modify: `site/src/components/CreateChoreForm.tsx`
- Modify: `site/src/components/ChoreRow.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `WEEKDAY_BITS`, `DayName`, `DAY_NAMES`, `bitmaskFromDayNames(names: DayName[]): number`, `dayNamesFromBitmask(mask: number): DayName[]`, `isDayInBitmask(mask: number, date: Date): boolean`

**Confirmed bug.** `CreateChoreForm.tsx` encodes `Sunday=1 … Saturday=64`; `ChoreRow.tsx`, `PaymentType::get_assigned_days_count`, `src/test_helpers.rs::days_bitmask` (`1 << (day-1)`, Monday=1) and `CLAUDE.md` all use `Monday=1 … Sunday=64`. A chore saved as Monday renders on Tuesday.

> **STOP — read before running the migration.** This rewrites production data. Confirm with Steve that a backup of `db/db.sqlite` exists, and confirm the premise: that **every** existing `chores.required_days` row was written through the admin form (Sunday-first). Rows created by tests or seeds use Monday-first and must **not** be rotated. If any Monday-first rows exist in the live database, this migration corrupts them — in that case stop and reduce scope to the code fix only.

- [ ] **Step 1: Write the failing utility tests**

Create `site/src/utils/__tests__/weekdayBitmask.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  WEEKDAY_BITS,
  DAY_NAMES,
  bitmaskFromDayNames,
  dayNamesFromBitmask,
  isDayInBitmask,
} from '../weekdayBitmask';

describe('weekdayBitmask', () => {
  it('places Monday at bit 0 and Sunday at bit 6, matching the backend', () => {
    expect(WEEKDAY_BITS.Monday).toBe(1);
    expect(WEEKDAY_BITS.Tuesday).toBe(2);
    expect(WEEKDAY_BITS.Wednesday).toBe(4);
    expect(WEEKDAY_BITS.Thursday).toBe(8);
    expect(WEEKDAY_BITS.Friday).toBe(16);
    expect(WEEKDAY_BITS.Saturday).toBe(32);
    expect(WEEKDAY_BITS.Sunday).toBe(64);
  });

  it('matches the backend day_patterns fixtures', () => {
    // src/test_helpers.rs: mon_wed_fri() == 21, weekdays() == 31, every_day() == 127
    expect(bitmaskFromDayNames(['Monday', 'Wednesday', 'Friday'])).toBe(21);
    expect(bitmaskFromDayNames(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])).toBe(31);
    expect(bitmaskFromDayNames([...DAY_NAMES])).toBe(127);
  });

  it('round-trips names through the mask', () => {
    for (const days of [
      [] as const,
      ['Monday'] as const,
      ['Saturday', 'Sunday'] as const,
      ['Monday', 'Wednesday', 'Friday'] as const,
    ]) {
      const mask = bitmaskFromDayNames([...days]);
      expect(dayNamesFromBitmask(mask)).toEqual([...days]);
    }
  });

  it('resolves a real Date against the mask', () => {
    // 2026-08-03 is a Monday; 2026-08-09 is a Sunday.
    const monday = new Date(2026, 7, 3);
    const sunday = new Date(2026, 7, 9);

    expect(isDayInBitmask(WEEKDAY_BITS.Monday, monday)).toBe(true);
    expect(isDayInBitmask(WEEKDAY_BITS.Monday, sunday)).toBe(false);
    expect(isDayInBitmask(WEEKDAY_BITS.Sunday, sunday)).toBe(true);
  });

  it('treats 0 as no scheduled days', () => {
    expect(dayNamesFromBitmask(0)).toEqual([]);
    expect(isDayInBitmask(0, new Date(2026, 7, 3))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd site && CI=true yarn test src/utils/__tests__/weekdayBitmask.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the utility**

Create `site/src/utils/weekdayBitmask.ts`:

```ts
/**
 * Single source of truth for the chore `requiredDays` weekday bitmask.
 *
 * Monday = bit 0 (1) through Sunday = bit 6 (64). This matches the Rust
 * backend (`PaymentType::get_assigned_days_count`), `src/test_helpers.rs`
 * (`days_bitmask`), and CLAUDE.md.
 *
 * Note this is deliberately independent of the *week start* convention:
 * `getWeekStartDate` in `dateUtils.ts` is Sunday-start. The two answer
 * different questions and must not be unified.
 */
export const WEEKDAY_BITS = {
  Monday: 1 << 0,
  Tuesday: 1 << 1,
  Wednesday: 1 << 2,
  Thursday: 1 << 3,
  Friday: 1 << 4,
  Saturday: 1 << 5,
  Sunday: 1 << 6,
} as const;

export type DayName = keyof typeof WEEKDAY_BITS;

/** Weekday names in mask-bit order, Monday first. */
export const DAY_NAMES = Object.keys(WEEKDAY_BITS) as DayName[];

/** Encodes a set of weekday names into a `requiredDays` mask. */
export function bitmaskFromDayNames(names: DayName[]): number {
  return names.reduce((acc, name) => acc | WEEKDAY_BITS[name], 0);
}

/** Decodes a `requiredDays` mask into weekday names, Monday first. */
export function dayNamesFromBitmask(mask: number): DayName[] {
  return DAY_NAMES.filter((name) => (mask & WEEKDAY_BITS[name]) !== 0);
}

/** True when `date`'s weekday is set in `mask`. Uses local time. */
export function isDayInBitmask(mask: number, date: Date): boolean {
  const mondayBasedIndex = (date.getDay() + 6) % 7;
  return (mask & (1 << mondayBasedIndex)) !== 0;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd site && CI=true yarn test src/utils/__tests__/weekdayBitmask.test.ts
```

Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit the utility before touching callers**

```bash
git add site/src/utils/weekdayBitmask.ts site/src/utils/__tests__/weekdayBitmask.test.ts
git commit -m "test: characterize weekday bitmask convention before tidy [T6]"
```

- [ ] **Step 6: Replace the two call sites**

In `site/src/components/CreateChoreForm.tsx`: delete the local `DAYS` map **and the warning TSDoc above it** (added by commit `7569caf` — it exists precisely to flag this bug and is now obsolete). Import from the utility instead. Replace:
- the edit-mode decode (`setSelectedDays(...)` with seven `requiredDays & <literal>` tests) → `setSelectedDays(dayNamesFromBitmask(initialChore.requiredDays ?? 0))`
- the submit reduce → `const requiredDays = bitmaskFromDayNames(selectedDays as DayName[]);` (this also removes the `DAYS[day as keyof typeof DAYS] ?? 0` cast)
- the `Object.keys(DAYS)` iteration in the day-picker JSX → `DAY_NAMES`
- `selectedDays` state type → `DayName[]`

In `site/src/components/ChoreRow.tsx`: delete the local `isChoreScheduledForDay` and call `isDayInBitmask(choreData.chore.requiredDays, date)` instead.

Locate all of these by symbol:

```bash
grep -n 'DAYS\|selectedDays\|isChoreScheduledForDay' \
  site/src/components/CreateChoreForm.tsx site/src/components/ChoreRow.tsx
```

- [ ] **Step 7: Verify the frontend**

```bash
cd site && yarn lint && yarn build && CI=true yarn test
```

Expected: all green. `tsc` proves the `DayName` typing is consistent.

- [ ] **Step 8: Generate the migration**

```bash
cd /home/steve/src/chore-tracker
diesel migration generate fix_required_days_bitmask
```

`up.sql` — rotate Sunday-first → Monday-first. This is a 7-bit **rotation**, not a shift: old bit 0 (Sunday) must wrap to bit 6.

```sql
-- Existing chores.required_days rows were written by the admin form using a
-- Sunday-first layout (Sunday=1, Monday=2 ... Saturday=64). The backend, and
-- now the frontend, use Monday-first (Monday=1 ... Sunday=64). Rotate right by
-- one within 7 bits: Sunday's bit wraps from bit 0 to bit 6.
-- new = ((old >> 1) | (old << 6)) & 127
UPDATE chores
SET required_days = ((required_days >> 1) | (required_days << 6)) & 127
WHERE required_days <> 0;
```

`down.sql` — the inverse rotation (rotate left by one within 7 bits):

```sql
-- Inverse of up.sql: rotate left by one within 7 bits.
-- old = ((new << 1) | (new >> 6)) & 127
UPDATE chores
SET required_days = ((required_days << 1) | (required_days >> 6)) & 127
WHERE required_days <> 0;
```

Sanity-check the arithmetic before running: old `2` (Mon) → `(1 | 128) & 127` = `1` ✓; old `1` (Sun) → `(0 | 64) & 127` = `64` ✓; old `64` (Sat) → `(32 | 4096) & 127` = `32` ✓. `0` is excluded by the `WHERE` clause, so daily and bonus chores are untouched.

- [ ] **Step 9: Test the migration in both directions**

Project convention requires `run → revert → run`:

```bash
diesel migration run
diesel migration revert
diesel migration run
```

Then prove the round-trip preserves masks. Against a scratch copy of the database, record `SELECT id, required_days FROM chores ORDER BY id;` before `run`, after `run`, after `revert` — the before and after-revert sets must be identical, and the after-`run` set must be the rotation.

- [ ] **Step 10: Regenerate the schema only if it changed**

This migration is data-only — it alters no columns — so `src/schema.rs` should be unchanged. Confirm:

```bash
diesel print-schema > /tmp/schema-check.rs && diff /tmp/schema-check.rs src/schema.rs && echo "schema unchanged (expected)"
```

If it differs, something structural was written by mistake — stop and re-read `up.sql`.

- [ ] **Step 11: Run everything, strip T6, commit**

```bash
cd site && yarn build && CI=true yarn test && cd .. && cargo test
git add site/src/components/CreateChoreForm.tsx site/src/components/ChoreRow.tsx \
        migrations/
git commit -m "tidy(duplication): unify weekday bitmask on Monday-first and migrate rows [T6]

CreateChoreForm encoded requiredDays Sunday-first (Sunday=1) while
ChoreRow, PaymentType::get_assigned_days_count and CLAUDE.md all use
Monday-first, so a chore saved as Monday rendered on Tuesday. Both call
sites now share site/src/utils/weekdayBitmask.ts.

Existing rows were written with the Sunday-first encoding, so the
migration rotates chores.required_days right by one within 7 bits
(Sunday's bit wraps 0 -> 6). Rows with required_days = 0 are untouched.

Removes T6 from TIDY.md."
```

---

## Group B — Backend structure

### Task 4: Single source of truth for admin session extraction (T10)

**Files:**
- Modify: `src/auth.rs` (add `ADMIN_SESSION_COOKIE`, `admin_id_from_jar`; rework `check_admin_session`)
- Modify: `src/api/graphql.rs`
- Modify: `src/api/images.rs` (`require_admin_cookie`)
- Test: `src/auth.rs` `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `AdminSvc::get_session(context, token) -> Result<Option<Admin>>` (read the real signature first and match it)
- Produces: `pub const ADMIN_SESSION_COOKIE: &str = "admin_session";` and `pub fn admin_id_from_jar(context: &GraphQLContext, jar: &CookieJar) -> anyhow::Result<Option<i32>>`

Three implementations of the same lookup with **drifted error handling**: `src/api/graphql.rs` logs a DB error and silently downgrades to unauthenticated; `src/api/images.rs` surfaces it as `AppError`/404; `src/auth.rs` propagates `anyhow`.

> **Decision required before coding.** Pick ONE policy for the DB-error case. **Recommended: propagate.** Treating a transient database fault as "not logged in" silently downgrades an admin to anonymous, which is how privilege checks quietly fail open. Whichever Steve picks, apply it at all three sites, state it in the commit body, and pin it with the test in Step 2. If propagate is chosen, `src/api/graphql.rs` loses its warn-and-continue branch — call that out in the commit body since it is a behaviour change.

- [ ] **Step 1: Locate all six literal sites**

```bash
grep -rn 'admin_session' src/
```

Expected: `src/auth.rs` (cookie build, get, remove), `src/api/graphql.rs`, `src/api/images.rs`.

- [ ] **Step 2: Write the failing tests**

```rust
#[test]
fn admin_id_from_jar_returns_none_without_a_cookie() {
    let context = test_db::create_test_context();
    let jar = CookieJar::new();
    assert_eq!(admin_id_from_jar(&context, &jar).unwrap(), None);
}

#[test]
fn admin_id_from_jar_returns_none_for_an_unknown_token() {
    let context = test_db::create_test_context();
    let jar = CookieJar::new().add(Cookie::new(ADMIN_SESSION_COOKIE, "not-a-real-token"));
    assert_eq!(admin_id_from_jar(&context, &jar).unwrap(), None);
}

#[test]
fn admin_id_from_jar_resolves_a_valid_session() {
    let context = test_db::create_test_context();
    let admin = test_db::create_test_admin(&context, "Parent", "parent@example.com");
    let token = create_session_for_test(&context, admin.id.unwrap());

    let jar = CookieJar::new().add(Cookie::new(ADMIN_SESSION_COOKIE, token));
    assert_eq!(admin_id_from_jar(&context, &jar).unwrap(), Some(admin.id.unwrap()));
}
```

`create_session_for_test` is a local helper — implement it with whatever `AdminSvc` function creates a session row (read `src/svc/admin.rs` first and use its real signature).

- [ ] **Step 3: Run to verify failure**

```bash
cargo test admin_id_from_jar
```

Expected: FAIL — function does not exist.

- [ ] **Step 4: Commit the characterization tests**

```bash
git add src/auth.rs
git commit -m "test: characterize admin session extraction before tidy [T10]"
```

- [ ] **Step 5: Implement the shared helper**

In `src/auth.rs`, next to `check_admin_session`:

```rust
/// Name of the cookie carrying an admin session token.
pub const ADMIN_SESSION_COOKIE: &str = "admin_session";

/// Resolves the admin session cookie in `jar` to an admin id.
///
/// Returns `Ok(None)` when there is no cookie or the token matches no live
/// session. A database failure is propagated as `Err` — it is deliberately
/// NOT reported as "not logged in", because silently downgrading an admin to
/// anonymous on a transient fault fails open.
pub fn admin_id_from_jar(
    context: &GraphQLContext,
    jar: &CookieJar,
) -> anyhow::Result<Option<i32>> {
    jar.get(ADMIN_SESSION_COOKIE)
        .map(|cookie| AdminSvc::get_session(context, cookie.value()))
        .transpose()?
        .flatten()
        .and_then(|admin| admin.id)
        .pipe(Ok)
}
```

If `tap::Pipe` is not already a dependency, write the tail plainly instead:

```rust
    let Some(cookie) = jar.get(ADMIN_SESSION_COOKIE) else {
        return Ok(None);
    };
    Ok(AdminSvc::get_session(context, cookie.value())?.and_then(|admin| admin.id))
```

Prefer the plain form — do not add a dependency for this.

- [ ] **Step 6: Route all call sites through it**

- `src/auth.rs`: `check_admin_session` delegates to `admin_id_from_jar`; the `Cookie::build` / `jar.get` / `jar.remove` sites use `ADMIN_SESSION_COOKIE`.
- `src/api/graphql.rs`: replace the inline lookup with `admin_id_from_jar(&context, &jar)?`, applying the chosen error policy.
- `src/api/images.rs`: `require_admin_cookie` becomes
  `admin_id_from_jar(context, jar).map_err(AppError)?.ok_or_else(|| AppError(anyhow!("Unauthorized")))`.
  Use the already-imported `anyhow!` macro rather than a fully-qualified path (project import convention).

- [ ] **Step 7: Verify, format, strip T10, commit**

```bash
cargo test && cargo clippy --all-targets
rustfmt --edition 2024 src/auth.rs src/api/graphql.rs src/api/images.rs
git diff --stat   # confirm no unrelated file moved
git add src/auth.rs src/api/graphql.rs src/api/images.rs
git commit -m "tidy(duplication): centralise admin session extraction [T10]

<state the chosen DB-error policy and, if propagate was chosen, note that
src/api/graphql.rs no longer downgrades a database fault to anonymous>

Removes T10 from TIDY.md."
```

---

### Task 5: One connection and one transaction in `ChoreCompletionSvc::create` (T16)

**Files:**
- Modify: `src/svc/chore_completion.rs` (`create`)
- Modify: `src/svc/chore.rs` (`can_claim_bonus`)
- Test: `src/svc/chore_completion.rs` `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `PaymentType::calculate_completion_amount`
- Produces: `ChoreSvc::can_claim_bonus_for(chore: &Chore, conn: &mut SqliteConnection) -> Result<bool>` (new, private-friendly); `ChoreCompletionSvc::create` signature **unchanged**
- Also produces (internal): `fn ensure_bonus_claim_allowed(...)`, `fn new_completion(input, amount_cents) -> ChoreCompletion`

`create` takes five pool connections and fetches the same chore twice because `can_claim_bonus` re-loads it.

- [ ] **Step 1: Write characterization tests pinning computed amounts and the cap**

```rust
#[test]
fn create_computes_daily_amount_unchanged() {
    let context = test_db::create_test_context();
    let admin = test_db::create_test_admin(&context, "Parent", "p@example.com");
    let user = test_db::create_test_user(&context, "Kid");
    let chore = test_db::create_test_chore(
        &context, "Dishes", PaymentType::Daily, 150,
        test_db::day_patterns::mon_wed_fri(), admin.id.unwrap(),
    );

    let completion = ChoreCompletionSvc::create(&context, &completion_input(&chore, &user)).unwrap();
    assert_eq!(completion.amount_cents, 150, "daily chores pay the full amount per completion");
}

#[test]
fn create_computes_weekly_split_unchanged() {
    let context = test_db::create_test_context();
    let admin = test_db::create_test_admin(&context, "Parent", "p@example.com");
    let user = test_db::create_test_user(&context, "Kid");
    // 150 cents over Mon/Wed/Fri == 3 days == 50/day.
    let chore = test_db::create_test_chore(
        &context, "Trash", PaymentType::Weekly, 150,
        test_db::day_patterns::mon_wed_fri(), admin.id.unwrap(),
    );

    let completion = ChoreCompletionSvc::create(&context, &completion_input(&chore, &user)).unwrap();
    assert_eq!(completion.amount_cents, 50, "weekly chores split across assigned days");
}

#[test]
fn create_rejects_a_bonus_claim_past_the_cap() {
    let context = test_db::create_test_context();
    let admin = test_db::create_test_admin(&context, "Parent", "p@example.com");
    let user = test_db::create_test_user(&context, "Kid");
    let chore = create_bonus_chore_for_test(&context, admin.id.unwrap(), /* max_claims */ 1);

    ChoreCompletionSvc::create(&context, &completion_input(&chore, &user)).unwrap();
    let second = ChoreCompletionSvc::create(&context, &completion_input(&chore, &user));

    assert!(second.is_err(), "second claim must be rejected once max_claims is reached");
}
```

`completion_input` and `create_bonus_chore_for_test` are local helpers — build them from the real `ChoreCompletionInput` / `ChoreInput` structs.

> Do **not** assert on the weekly rounding remainder here. That behaviour is finding T15, which Steve explicitly skipped; these tests pin only what T16 must preserve.

- [ ] **Step 2: Run to verify they pass on unchanged code**

```bash
cargo test create_computes create_rejects_a_bonus_claim
```

Expected: PASS — these are characterization tests; they must be green **before** the refactor.

- [ ] **Step 3: Commit them**

```bash
git add src/svc/chore_completion.rs
git commit -m "test: characterize ChoreCompletionSvc::create before tidy [T16]"
```

- [ ] **Step 4: Add a chore-taking cap check**

In `src/svc/chore.rs`, add alongside `can_claim_bonus`:

```rust
/// Cap check against an already-loaded chore, sharing the caller's connection.
///
/// `max_claims == None` means unlimited. The cap counts completions of the
/// chore across ALL users, not per user.
pub fn can_claim_bonus_for(chore: &Chore, conn: &mut SqliteConnection) -> Result<bool> {
    let Some(max_claims) = chore.max_claims else {
        return Ok(true);
    };
    let chore_id = chore.id.context("chore has no id")?;
    let claimed: i64 = chore_completions::table
        .filter(chore_completions::chore_id.eq(chore_id))
        .count()
        .get_result(conn)?;
    Ok(claimed < i64::from(max_claims))
}
```

Keep the existing `can_claim_bonus(context, chore_id)` as a thin wrapper so no public signature changes.

- [ ] **Step 5: Restructure `create`**

Extract two helpers in `src/svc/chore_completion.rs`:

```rust
fn ensure_bonus_claim_allowed(chore: &Chore, conn: &mut SqliteConnection) -> Result<()> {
    if chore.bonus_date.is_some() && !ChoreSvc::can_claim_bonus_for(chore, conn)? {
        anyhow::bail!("Bonus chore has reached its claim limit");
    }
    Ok(())
}

fn new_completion(input: &ChoreCompletionInput, amount_cents: i32) -> ChoreCompletion {
    // Move the existing 14-field struct literal here verbatim, substituting
    // `amount_cents` for the computed value. Change no field.
}
```

Then rewrite `create` to take **one** connection and wrap the guard, insert, and re-read in `conn.transaction(|conn| { … })` — which also closes the check-then-insert race on capped bonus chores. The body reads: fetch chore → `ensure_bonus_claim_allowed` → compute amount → `new_completion` → insert → re-read.

Match the existing error-context style (`.context("…")`) on each fallible step.

- [ ] **Step 6: Verify, format, strip T16, commit**

```bash
cargo test && cargo clippy --all-targets
rustfmt --edition 2024 src/svc/chore_completion.rs src/svc/chore.rs
git diff --stat
git add src/svc/chore_completion.rs src/svc/chore.rs
git commit -m "tidy(long-methods): single-connection transactional completion create [T16]

create took five pool connections and loaded the same chore twice because
can_claim_bonus re-fetched it. The guard, insert and re-read now share one
connection inside a transaction, which also closes the check-then-insert
race on capped bonus chores. Computed amounts are unchanged (pinned by
the characterization tests in the preceding commit).

Removes T16 from TIDY.md."
```

---

### Task 6: Decompose `UserSvc::balances` (T17)

**Files:**
- Modify: `src/svc/user.rs`
- Test: `src/svc/user.rs` `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: the `ynab_api` crate's `Configuration` and `CategoryGroupWithCategories`
- Produces: `fn ynab_configuration() -> Configuration`, `fn kid_balances(group: &CategoryGroupWithCategories) -> Result<Vec<UserBalance>>`, `const YNAB_BUDGET_ID`, `const KIDS: [(&str, &str); 3]`

52 lines spanning env read, HTTP client config, remote fetch, group lookup, category scan, and result assembly, with three `Option` locals, three `ok_or_else` unwraps, and a hardcoded budget id.

**This function calls a third-party API. Tests must not hit the network** — characterize `kid_balances` as a pure function over a constructed `CategoryGroupWithCategories`.

- [ ] **Step 1: Read the current implementation and the ynab_api types**

```bash
grep -n 'pub async fn balances' -A55 src/svc/user.rs
grep -rn 'pub struct CategoryGroupWithCategories' -A15 ynab-api/src/
```

Note the exact field names and whether `balance` is `i64` milliunits.

- [ ] **Step 2: Write the failing tests for the extracted pure function**

```rust
#[test]
fn kid_balances_converts_milliunits_to_dollars() {
    let group = category_group_for_test(&[
        ("Aurora Cash", 12_500),   // milliunits -> 12.50
        ("Madeline Cash", 0),
        ("AJ Cash", 1_000),        // -> 1.00
    ]);

    let balances = kid_balances(&group).unwrap();

    assert_eq!(balances.len(), 3);
    assert_eq!(balances[0].name, "Aurora");
    assert!((balances[0].balance - 12.50).abs() < f64::EPSILON);
    assert!((balances[2].balance - 1.00).abs() < f64::EPSILON);
}

#[test]
fn kid_balances_errors_when_a_category_is_missing() {
    let group = category_group_for_test(&[("Aurora Cash", 100)]);
    assert!(kid_balances(&group).is_err(), "a missing kid category must be an error, not a silent zero");
}
```

`category_group_for_test` builds a `CategoryGroupWithCategories` literal from the pairs. Preserve the current divisor — read it from the existing code rather than assuming 1000.

- [ ] **Step 3: Run to verify failure**

```bash
cargo test kid_balances
```

Expected: FAIL — function does not exist.

- [ ] **Step 4: Commit the tests**

```bash
git add src/svc/user.rs
git commit -m "test: characterize YNAB balance mapping before tidy [T17]"
```

- [ ] **Step 5: Extract**

```rust
/// YNAB budget the family's allowance categories live in.
const YNAB_BUDGET_ID: &str = "<copy the existing literal verbatim>";

/// (YNAB category name, display name) for each child.
/// Adding a child is a one-line change here.
const KIDS: [(&str, &str); 3] = [
    ("Aurora Cash", "Aurora"),
    ("Madeline Cash", "Madeline"),
    ("AJ Cash", "AJ"),
];

/// Builds the YNAB client configuration from the `YNAB_TOKEN` env var.
fn ynab_configuration() -> Configuration { /* lines currently inline in balances */ }

/// Maps the "Kids Allowances" category group to per-child balances in dollars.
///
/// Errors if any configured child category is absent from the group.
fn kid_balances(group: &CategoryGroupWithCategories) -> Result<Vec<UserBalance>> {
    KIDS.iter()
        .map(|(category_name, display_name)| {
            let category = group
                .categories
                .iter()
                .find(|c| c.name == *category_name)
                .with_context(|| format!("YNAB category {category_name} not found"))?;
            Ok(UserBalance {
                name: (*display_name).to_owned(),
                balance: category.balance as f64 / 1000.0, // milliunits -> dollars
            })
        })
        .collect()
}
```

`balances` then reads: build config → fetch group → `kid_balances(&group)`.

- [ ] **Step 6: Verify, format, strip T17, commit**

```bash
cargo test && cargo clippy --all-targets
rustfmt --edition 2024 src/svc/user.rs
git diff --stat
git add src/svc/user.rs
git commit -m "tidy(long-methods): decompose UserSvc::balances [T17]

Splits the 52-line function into ynab_configuration() and a pure
kid_balances() that is testable without network access, and replaces the
three Option locals with a KIDS table so adding a child is a one-line
change. The hardcoded budget id is now YNAB_BUDGET_ID.

Removes T17 from TIDY.md."
```

---

### Task 7: Batch-load `ChoreCompletion` field resolvers (T13)

**Files:**
- Modify: `src/context.rs` (add per-request memo caches)
- Modify: `src/models.rs` (`ChoreCompletion::chore`, `::user`, `::notes`)
- Test: `src/models.rs` test module

**Interfaces:**
- Consumes: `GraphQLContext` (extended here), and **the admin-gated `notes` behaviour from Task 2**
- Produces: memo caches on `GraphQLContext`

**Must run after Task 2.** The `notes` resolver's visibility argument changes there; batching must carry the corrected gate, not the leaky one.

`chore`, `user`, and `notes` each run a separate query and pool checkout per completion, while `GET_ALL_WEEKLY_COMPLETIONS` requests all three and polls every 30 s.

- [ ] **Step 1: Write the failing test asserting resolved values are unchanged**

The behaviour to preserve is *identity of results*, plus the Task 2 gate. Write a test that resolves the three fields for several completions and asserts values, then asserts the note gate still holds:

```rust
#[test]
fn batched_resolvers_return_the_same_values_as_before() {
    let context = test_db::create_test_context();
    let admin = test_db::create_test_admin(&context, "Parent", "p@example.com");
    let user = test_db::create_test_user(&context, "Kid");
    let chore = test_db::create_test_chore(
        &context, "Dishes", PaymentType::Daily, 100,
        test_db::day_patterns::monday_only(), admin.id.unwrap(),
    );

    let completions: Vec<_> = (0..3)
        .map(|i| create_completion_on_day(&context, &chore, &user, i))
        .collect();

    for completion in &completions {
        let resolved_chore = futures::executor::block_on(completion.chore(&context)).unwrap();
        let resolved_user = futures::executor::block_on(completion.user(&context)).unwrap();
        assert_eq!(resolved_chore.id, chore.id);
        assert_eq!(resolved_user.id, user.id);
    }
}
```

Use whatever async test harness the crate already uses (`tokio::test` if present) rather than `futures::executor` if that is the established pattern — check the existing tests first.

Also re-run the Task 2 tests unchanged; they are the regression guard on the gate.

- [ ] **Step 2: Run, commit as characterization**

```bash
cargo test batched_resolvers
git add src/models.rs
git commit -m "test: characterize completion field resolvers before tidy [T13]"
```

- [ ] **Step 3: Add memo caches to the context**

In `src/context.rs`, extend `GraphQLContext`:

```rust
use std::{collections::HashMap, sync::{Arc, Mutex}};

#[derive(Clone)]
pub struct GraphQLContext {
    pub pool: Pool<ConnectionManager<SqliteConnection>>,
    pub admin_id: Option<i32>,
    /// Per-request memo of chores already resolved, keyed by chore id.
    pub chore_cache: Arc<Mutex<HashMap<i32, Chore>>>,
    /// Per-request memo of users already resolved, keyed by user id.
    pub user_cache: Arc<Mutex<HashMap<i32, User>>>,
}
```

**This changes every `GraphQLContext { … }` literal.** Find them all — including `src/test_helpers.rs::create_test_context` — and update:

```bash
grep -rn 'GraphQLContext {' src/ tests/
```

Prefer adding `impl Default`/a constructor so future fields do not repeat this churn, but do **not** change `GraphQLContext`'s public field names (that would be a disabled public-API change).

- [ ] **Step 4: Use the caches in the resolvers**

In `ChoreCompletion::chore` and `::user`, check the cache before querying and populate on miss. Keep the lock scope tight — acquire, look up, drop before doing any I/O; never hold the mutex across a database call.

Leave `notes` on its per-completion query but **preserve `context.admin_id.is_none()` from Task 2** verbatim.

- [ ] **Step 5: Verify, format, strip T13, commit**

```bash
cargo test && cargo clippy --all-targets
rustfmt --edition 2024 src/context.rs src/models.rs src/test_helpers.rs
git diff --stat
git add src/context.rs src/models.rs src/test_helpers.rs
git commit -m "tidy(opportunistic): memoise completion field resolvers per request [T13]

chore/user resolvers ran one query and one pool checkout per completion
while the weekly grid polls every 30s. They now share a per-request memo
on GraphQLContext. Note visibility continues to follow context.admin_id
(T14) — the gate is carried through, not bypassed.

Removes T13 from TIDY.md."
```

---

## Group C — Frontend utility

### Task 8: Document the week-start convention; unexport three helpers (T9)

**Files:**
- Modify: `site/src/utils/dateUtils.ts`

**Interfaces:**
- Consumes: `site/src/utils/weekdayBitmask.ts` (cross-reference only)
- Produces: `getWeekStartDate`, `getWeekEndDate`, `isSameDay` become module-private

- [ ] **Step 1: Confirm the three helpers have no external importers**

```bash
grep -rn '\bgetWeekStartDate\b\|\bgetWeekEndDate\b\|\bisSameDay\b' site/src --include=*.ts --include=*.tsx
```

Expected: exactly two hits each — the declaration and one internal caller (`getWeekDateRange` uses the first two, `isSameDayAsString` the third). **If any hit is outside `dateUtils.ts`, stop** and drop the unexport half of this task; the documentation half still applies.

- [ ] **Step 2: Add the TSDoc**

```ts
/**
 * Start of the week containing `date`, as a local-time, midnight-normalised
 * Date. Weeks are treated as **Sunday-start**: this is the value sent to the
 * backend as `weekStartDate`.
 *
 * Deliberately independent of the chore `requiredDays` bitmask, which is
 * Monday-first (see `utils/weekdayBitmask.ts`). The two answer different
 * questions — "which calendar week am I looking at" vs "which weekdays is
 * this chore scheduled for" — and must not be unified.
 */
```

- [ ] **Step 3: Drop the `export` keyword from the three declarations**

- [ ] **Step 4: Verify**

```bash
cd site && yarn lint && yarn build && CI=true yarn test
```

Expected: green. `tsc` proves nothing outside the module referenced them.

- [ ] **Step 5: Strip T9 and commit**

```bash
git add site/src/utils/dateUtils.ts
git commit -m "tidy(comments,dead-code): document Sunday-start weeks, unexport internals [T9]

Removes T9 from TIDY.md."
```

---

## Group D — Component extractions

**Applies to every task in this group.** These are presentational React components with `risk: high`. Characterization means React Testing Library tests asserting rendered output and handler wiring **before** extraction, so the extraction is provably behaviour-preserving. Follow the existing pattern in `site/src/components/__tests__/Button.test.tsx` and `site/src/hooks/__tests__/useBonusChores.test.tsx` (vitest + `MockedProvider` from `@apollo/client/testing/react`, `vi.mock('react-toastify')`).

Each task's cycle is identical:
1. Write characterization tests for the component's current rendered behaviour. Commit as `test: characterize <Component> before tidy [T<n>]`.
2. Extract, moving JSX **verbatim** into the new components — a move is fully specified by its source range and target; change no markup, no class strings, no handler wiring.
3. Re-run the same tests unchanged. They must pass without modification. **If a characterization test needs editing to pass, the extraction changed behaviour — revert and redo.**
4. `yarn lint && yarn build && CI=true yarn test`, strip the finding, commit.

Run the full suite at the end of this group.

### Task 9: Extract `AdminChoreManagement` (T1)

**Files:**
- Create: `site/src/hooks/useUserImages.ts`, `site/src/components/AdminChoreToolbar.tsx`, `ChoreAssignmentModal.tsx`, `UserManagementModal.tsx`
- Modify: `site/src/components/AdminChoreManagement.tsx`
- Test: `site/src/components/__tests__/AdminChoreManagement.test.tsx`

**Interfaces:**
- Produces: `useUserImages(refetchUsers: () => Promise<unknown>) => { uploadImage(userUuid: string, file: File): Promise<void>; removeImage(userId: number): Promise<void> }`

- [ ] **Step 1: Characterization tests** — assert the four toolbar buttons render and each opens its modal; assert image upload calls `POST /images/upload/:uuid` and remove calls `DELETE /images/user/:id`, each followed by `refetchUsers`. Mock `fetch` with `vi.stubGlobal('fetch', vi.fn())`.
- [ ] **Step 2: Run, confirm green, commit** as `test: characterize AdminChoreManagement before tidy [T1]`.
- [ ] **Step 3: Extract `useUserImages`** — move the two raw `fetch` calls out of the component and route them through the existing `site/src/utils/withErrorToast.ts` helper rather than hand-rolled try/catch.
- [ ] **Step 4: Extract the three components** — `<AdminChoreToolbar onManageUsers onCreateUser onCreateChore onCreateBonusChore />` (the 4-button block), `<ChoreAssignmentModal chore users onAssign onUnassign onClose />`, `<UserManagementModal users isOpen onClose onImageUpload onRemoveImage />`. Move JSX verbatim.
- [ ] **Step 5: Re-run the unchanged tests, then `yarn lint && yarn build && CI=true yarn test`.**
- [ ] **Step 6: Strip T1, commit** as `tidy(long-methods): extract AdminChoreManagement into hook + three components [T1]`.

### Task 10: Extract `ChoreCompletionDetail` (T4)

**Files:**
- Create: `site/src/hooks/useCompletionActions.ts`, `site/src/components/CompletionSummary.tsx`, `CompletionNotesList.tsx`, `AddNoteForm.tsx`
- Modify: `site/src/components/ChoreCompletionDetail.tsx`
- Test: `site/src/components/__tests__/ChoreCompletionDetail.test.tsx`

**Interfaces:**
- Produces: `useCompletionActions({ completion, isAdmin, adminId, userId, onUpdate, onClose }) => { addNote, approve, reject }`

- [ ] **Step 1: Characterization tests** — assert the summary fields render; that the notes list shows user-visible notes and, for an admin, admin notes; and that approve/reject/add-note fire their mutations. Use `MockedProvider`.
- [ ] **Step 2: Run, confirm green, commit** as `test: characterize ChoreCompletionDetail before tidy [T4]`.
- [ ] **Step 3: Extract `useCompletionActions`** holding the three `useMutation` blocks and their handlers.
- [ ] **Step 4: Split the render** into `<CompletionSummary/>`, `<CompletionNotesList/>`, `<AddNoteForm/>`, moving JSX verbatim.
- [ ] **Step 5: Re-run unchanged tests; lint, build, test.**
- [ ] **Step 6: Strip T4, commit** as `tidy(long-methods): extract ChoreCompletionDetail into hook + three components [T4]`.

> Related but **out of scope**: finding T12 notes the kid-facing Add Note button always errors because `createChoreCompletionNote` requires admin. T12 was not selected — do not fix it here. Leave the button as-is.

### Task 11: Extract `AdminPayoutSystem` (T3)

**Files:**
- Create: `site/src/components/PayoutSummaryCards.tsx`, `PayoutUserRow.tsx`, `PayoutActionsPanel.tsx`
- Modify: `site/src/components/AdminPayoutSystem.tsx`
- Test: `site/src/components/__tests__/AdminPayoutSystem.test.tsx`

- [ ] **Step 1: Characterization tests** — assert the three summary figures (user count, total unpaid, selected total) compute correctly from mocked `unpaidTotals`; assert toggling a user updates the selected total; assert the process-payout button fires its mutation with the selected ids.
- [ ] **Step 2: Run, confirm green, commit** as `test: characterize AdminPayoutSystem before tidy [T3]`.
- [ ] **Step 3: Extract** `<PayoutSummaryCards userCount totalUnpaidAmount selectedTotal />`, `<PayoutUserRow total selected onToggle />`, `<PayoutActionsPanel selectedCount selectedTotal isProcessing onProcess />`, moving JSX verbatim.
- [ ] **Step 4: Wrap the two reductions in `useMemo`** keyed on `[unpaidTotals, selectedUsers]`.
- [ ] **Step 5: Remove the stale `Recent Activity` placeholder block.**
- [ ] **Step 6: Re-run unchanged tests; lint, build, test. Strip T3, commit** as `tidy(long-methods): extract AdminPayoutSystem into three components [T3]`.

### Task 12: Collapse `AdminCompletionReview` onto existing components (T2)

**Files:**
- Modify: `site/src/components/AdminCompletionReview.tsx`, `site/src/components/CompletionCard.tsx`
- Test: `site/src/components/__tests__/AdminCompletionReview.test.tsx`

**This task reuses existing components — it creates none.** `CompletionCard.tsx` already supports both variants via `showActions`, and `WeekNavigator.tsx` already implements the week controls. The TIDY entries proposing *new* `CompletionReviewCard`/`CompletionSection` components (T27, T73) were **not** selected.

- [ ] **Step 1: Characterization tests** — assert pending completions render with approve/reject and approved ones render with an `approvedAt` line; assert the week controls move the range.
- [ ] **Step 2: Run, confirm green, commit** as `test: characterize AdminCompletionReview before tidy [T2]`.
- [ ] **Step 3: Add `actionsLayout?: 'row' | 'stacked'` to `CompletionCard`.** The pending block uses `flex md:flex-col gap-2` for its button stack where `CompletionCard` uses `flex gap-2`; this prop is the only cosmetic delta. Default it to `'row'` so existing usage is unchanged.
- [ ] **Step 4: Replace both inline card blocks** with `<CompletionCard … showActions actionsLayout="stacked" />` (pending) and `<CompletionCard … />` (approved).
- [ ] **Step 5: Replace the prev/this-week/next trio** with `<WeekNavigator currentWeekStart onWeekChange weekRange />`, then trim the now-unused `getPreviousWeek`/`getNextWeek` imports.
- [ ] **Step 6: Re-run unchanged tests; lint, build, test. Strip T2, commit** as `tidy(duplication): reuse CompletionCard and WeekNavigator in AdminCompletionReview [T2]`.

> `useWeeklyCompletions` (an existing, unused hook) duplicates this component's data layer — that is finding T27, **not selected**. Do not swap the data layer here; this task is markup-only.

### Task 13: Extract `WeeklyChoreView` (T7)

**Files:**
- Create: `site/src/hooks/useIsMobile.ts`, `site/src/hooks/useCompletionLookup.ts`, `site/src/components/BadgeChips.tsx`, `ChoreGrid.tsx`, `ChoreCardList.tsx`
- Modify: `site/src/components/WeeklyChoreView.tsx`
- Test: `site/src/components/__tests__/WeeklyChoreView.test.tsx`

**Interfaces:**
- Produces: `useIsMobile(breakpoint?: number): boolean` (default 600); `useCompletionLookup(allCompletionsData) => { isChoreCompletedByAnyone, isChoreCompletedByUser }`

- [ ] **Step 1: Characterization tests** — assert the desktop branch renders the grid and the mobile branch (viewport < 600) renders the card list; assert badges render once in each branch; assert a chore completed by another user shows the "completed by someone else" state.
- [ ] **Step 2: Run, confirm green, commit** as `test: characterize WeeklyChoreView before tidy [T7]`.
- [ ] **Step 3: Extract `useIsMobile`** from the resize effect.
- [ ] **Step 4: Extract `<BadgeChips badges wrap />`** — the two badge blocks differ only in class (`overflow-x-auto pb-1 mt-2` vs `flex-wrap mb-4`); pass that as a prop.
- [ ] **Step 5: Extract `<ChoreGrid/>` and `<ChoreCardList/>`** for the desktop/mobile branches, moving JSX verbatim.
- [ ] **Step 6: Move the lookup predicates and `completionLookup` memo into `useCompletionLookup`.**
- [ ] **Step 7: Preserve the doc-comment placement from `7569caf`** — the mobile/desktop rule comment now sits on the `currentDate` memo, where it belongs. Do not move it back.
- [ ] **Step 8: Re-run unchanged tests; lint, build, test. Strip T7, commit** as `tidy(long-methods): extract WeeklyChoreView into hooks + three components [T7]`.

---

## Final verification

- [ ] **Full suite, both stacks**

```bash
cd /home/steve/src/chore-tracker
cargo build && cargo clippy --all-targets && cargo test
cd site && yarn lint && yarn build && CI=true yarn test
```

Expected: green throughout; clippy shows only the documented baseline warnings.

- [ ] **Confirm all 14 findings were stripped from TIDY.md**

```bash
grep -cE '^### T[0-9]+\.' TIDY.md          # expect 89 (103 - 14)
grep -E '^### T(1|2|3|4|5|6|7|8|9|10|13|14|16|17)\.' TIDY.md || echo "all executed findings stripped"
```

`T11`, `T12` and `T15` must still be present — `T15` retains its `[x] skip`.

- [ ] **Confirm no unrelated formatting drift was committed**

```bash
git diff b59bb45..HEAD --stat -- src/ | tail -5
cargo fmt -- --check 2>&1 | grep -c '^Diff in'   # expect 13 — unchanged baseline
```

If the count moved from 13, a `cargo fmt` swept unrelated files into a commit — identify and revert it.

- [ ] **Report to Steve:** commits made, findings stripped, any item converted to `decision-needed`, and the state of the T6 migration (whether it was run against the live database or only tested).

## Out of scope

- `T11` (dead `pub struct Claims`), `T12` (unauthenticated `create_chore_completion`) — unchecked, remain in `TIDY.md`.
- `T15` (weekly rounding remainder) — explicitly skipped, recorded in user memory.
- All 89 remaining medium/low findings.
- The 13 pre-existing `cargo fmt` diffs.
- The flaky `site/src/App.test.tsx`.
