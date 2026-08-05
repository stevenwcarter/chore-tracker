# Tidy execution spec — high-severity batch (2026-08-04)

Source: `TIDY.md` triage against `tidy/2026-08-04` @ `b59bb45`.
Selected by Steve: 14 items (`[x] execute`). `T15` was marked `[x] skip` and is
recorded in user memory. `T11` and `T12` were left unchecked and stay in
`TIDY.md` for a later pass.

## Toolchain

| | Rust | Frontend (from `site/`) |
|---|---|---|
| build | `cargo build` | `yarn build` |
| lint | `cargo clippy --all-targets` | `yarn lint` |
| test | `cargo test` | `CI=true yarn test` |
| format | `cargo fmt` | `npx prettier --write <files>` |

`site/node_modules` and `site/build/` must exist — `site/build/` is gitignored
and `rust-embed` fails the Rust build without it. Run `yarn install && yarn build`
in `site/` before any `cargo build` in a fresh checkout.

**Preexisting clippy warning baseline** (do NOT attempt to fix, do NOT treat as
regressions): `src/auth.rs:327`, `src/auth.rs:394` (`result_large_err`),
`src/db.rs:75`, `src/lib.rs:1`, `src/lib.rs:2`, and
`src/svc/chore_completion.rs:563,564,570,571,577,578,584,585,713` (all inside
`#[cfg(test)]`). `cargo clippy --all-targets` exits 0 with these warnings; never
pass `-D warnings`.

### Operational facts verified on this clone (2026-08-04)

**The pre-commit hook does NOT run.** `.husky/pre-commit` exists and contains
`cd site && npx lint-staged && CI=true yarn test`, but `husky install` was never
run here: there is no `.husky/_`, no `core.hooksPath`, and no
`.git/hooks/pre-commit`. **Commits therefore run no tests and no formatting.**
Every task must run its own verification explicitly — do not assume committing
gates anything. (Still never pass `--no-verify`; it is simply moot here.)

**`cargo fmt` must NOT be run repo-wide.** The tree is not rustfmt-clean at
`HEAD`. `cargo fmt -- --check` currently reports 13 pre-existing diffs across
8 files: `src/auth.rs` (333, 375), `src/main.rs` (26), `src/models.rs` (247),
`src/svc/admin.rs` (1), `src/svc/badge.rs` (102, 175, 182, 232, 266),
`src/svc/chore.rs` (611), `src/test_helpers.rs` (40),
`tests/upgrade_jsonwebtoken.rs` (41).

A bare `cargo fmt` sweeps all of these into whatever commit is in flight,
polluting a tidy commit with unrelated reformatting and destroying its
revertability. Instead, format **only the files the task actually edited**:
`rustfmt --edition 2024 <file>`, then `git diff --stat` to confirm no unrelated
file moved. If a task's own file is one of the 8 listed above, restrict the fix
to the hunks the task touched and leave the pre-existing drift alone.

This drift is out of scope for this batch — it is recorded here so nobody
mistakes it for damage caused by tidy.

**`site/src/App.test.tsx` is flaky.** It fails intermittently on a `waitFor`
timeout under CPU contention (e.g. when run concurrently with `yarn build`), and
reproduces at parent commit `b59bb45` on an untouched tree. If it goes red at a
milestone, re-run it alone before concluding a regression; 15/15 passing on a
quiet machine is the expected state.

## Invariants this batch depends on

Per project spec discipline, these are the assumptions the work leans on. Any of
them flipping later should break a test, not silently change behaviour — each is
pinned by a named test below.

1. **Weekday bitmask is Monday-first** (`1=Mon … 64=Sun`) in the backend,
   `ChoreRow.tsx`, and `CLAUDE.md`. T6 makes the frontend agree and migrates
   stored rows. Pinned by a round-trip test over `bitmaskFromDayNames` /
   `dayNamesFromBitmask` **and** a Rust-side test asserting
   `get_assigned_days_count` counts the same bits.
2. **Week start is Sunday-based** (`getWeekStartDate`) and is *deliberately
   independent* of invariant 1. T9 documents this. Pinned by an existing/new
   `dateUtils` test asserting a Sunday start.
3. **Payout amounts are computed server-side** from
   `payment_type`/`amount_cents`/`required_days` and never accepted from the
   client. T13/T16 must not change any computed amount. Pinned by
   characterization tests on `ChoreCompletionSvc::create`.
4. **`admin_id` is `None` for unauthenticated (kid) GraphQL requests.** T14's
   note-visibility gate depends on this. Pinned by a test asserting a
   no-cookie request sees only `visible_to_user = true` notes.
5. **`chore_assignments` has a UNIQUE(chore_id, user_id) index**, making
   assignment idempotent. T10's session refactor must not alter this path.

## Ordering and dependencies

Work in four groups. Groups are ordered so that user-visible bugs land first and
the wide frontend refactors land last, when the suite is most exercised.

- **Group A — confirmed bugs:** T8 → T5 → T14 → T6
- **Group B — backend structure:** T10 → T16 → T17 → T13
- **Group C — small frontend:** T9
- **Group D — component extractions:** T1 → T4 → T3 → T2 → T7

Hard constraints:
- **T8 before T5.** Bonus-chore creation is rejected for *both* reasons; fixing
  either alone leaves it broken, so T5's verification depends on T8 landing.
- **T14 before T13.** Both touch the `notes` resolver at `src/models.rs:492`.
  T14 changes its visibility argument; T13 then batches it. Doing T13 first
  would bake the leak into the batch-loader.
- **T2 reuses existing components.** `CompletionCard.tsx` and `WeekNavigator.tsx`
  already exist and already support both variants; T2 must reuse them rather
  than introduce new `CompletionReviewCard`/`CompletionSection` components.
  (The TIDY entries proposing new components, T27/T73, were not selected.)
- T1's `useUserImages` extraction is standalone here — the related T24 was not
  selected.
- T7's `BadgeChips` extraction is standalone here — the related T75 was not
  selected.

## Risk policy

Ten of the 14 items carry `risk: high — needs characterization tests first`.
For each of those, the per-task contract is:

1. Write characterization tests for the affected unit.
2. Confirm they pass **against unchanged code**.
3. Commit as `test: characterize <unit> before tidy [T<n>]`.
4. Only then apply the change.

Do not skip a characterization test by arguing a current invariant makes it
safe — that is precisely the failure mode this project has been bitten by.

Run the full suite (`cargo test` + `CI=true yarn test`) at every group boundary
and after every 5 findings, whichever comes first. On red: bisect within the
group, revert the offender, surface the diagnosis.

---

## Group A — confirmed bugs

### T8. `CREATE_BONUS_CHORE` argument name mismatch
`site/src/graphql/queries.ts:278` · risk: high

The mutation sends `createBonusChore(input: $input)` but the Juniper resolver at
`src/graphql.rs:199-202` declares the argument as `chore: ChoreInput`. Every
bonus-chore creation fails schema validation.

Change the document to `mutation CreateBonusChore($chore: ChoreInput!) { createBonusChore(chore: $chore) { … } }`
and update both callers that build `variables: { input: … }` —
`site/src/hooks/useBonusChores.ts:45` and
`site/src/components/CreateBonusChoreForm.tsx:45` — to `variables: { chore: … }`.

### T5. Bonus chore form sends a lowercase enum value
`site/src/components/CreateBonusChoreForm.tsx:48` · risk: high

Sends `paymentType: 'daily'` where the GraphQL enum value is `DAILY`, so the
mutation is rejected even once T8 lands.

Import `PaymentType` from `types/chore` and send `PaymentType.Daily`, matching
`CreateChoreForm.tsx:77`. Also tighten `CreateBonusChoreInput.paymentType` in
`site/src/hooks/useBonusChores.ts:14` from `string` to `PaymentType` so the
compiler catches this class of mistake.

**Verification for T8+T5 together:** a test that exercises the bonus-chore
create path end-to-end and asserts the mutation is accepted. This is the
load-bearing test for the whole group — do not settle for a type-level check.

### T14. Admin-only notes leak to unauthenticated clients
`src/models.rs:492` · risk: high · **security**

The `notes` resolver passes `visible_to_user_only = false`, so admin-only notes
are serialised to unauthenticated kid clients and hidden only in the browser.

Change to `ChoreCompletionNoteSvc::list_for_completion(context, id, context.admin_id.is_none())`
so non-admin requests receive only `visible_to_user = true` notes. Additionally
make `admin_notes` call `context.require_admin()?` first.

**Characterization tests required:** one asserting an admin request still sees
all notes, and one asserting a request with no admin session sees only
user-visible notes. The second test is the one that would have caught this.

### T6. Weekday bitmask: frontend Sunday=1 vs backend Monday=1
`site/src/components/CreateChoreForm.tsx:13-21` · risk: high · **needs data migration**

`CreateChoreForm.tsx` encodes `Sunday=1 … Saturday=64`; `ChoreRow.tsx:34-40`,
`PaymentType::get_assigned_days_count`, and `CLAUDE.md` all use
`Monday=1 … Sunday=64`. A chore saved as Monday renders on Tuesday.

**Code:** create `site/src/utils/weekdayBitmask.ts` as the single source of
truth on the Monday-first convention, exporting `WEEKDAY_BITS`
(`Monday=1 … Sunday=64`), a `DayName` type, `DAY_NAMES`,
`bitmaskFromDayNames(names)`, `dayNamesFromBitmask(mask)`, and
`isDayInBitmask(mask, date)` implementing `(date.getDay() + 6) % 7`.
Replace: `CreateChoreForm.tsx:13-21` (the `DAYS` map and its new warning TSDoc),
`:51-57` (the decode loop), `:68-71` (the reduce, which also removes the
`DAYS[day as keyof typeof DAYS] ?? 0` cast), `:171` (`Object.keys(DAYS)`), and
`ChoreRow.tsx:34-40` (use `isDayInBitmask`).

**Data migration (decided by Steve — write it):** existing `chores.required_days`
rows were written with the Sunday=1 encoding. Add a Diesel migration
(`diesel migration generate fix_required_days_bitmask`) that rotates stored masks
from Sunday-first to Monday-first, with an inverse rotation in `down.sql`.

The rotation is a 7-bit rotate, not a shift — bit 0 (Sun) must wrap to bit 6:
`new = ((old >> 1) | (old << 6)) & 127`, inverse `old = ((new << 1) | (new >> 6)) & 127`.
Express this in SQL over `required_days`, and guard it to chores only.

**Tests required:**
- Round-trip: `dayNamesFromBitmask(bitmaskFromDayNames(days)) === days` for
  several day sets, plus explicit assertions that Monday is bit 0 and Sunday bit 6.
- `isDayInBitmask` agrees with the Rust `get_assigned_days_count` popcount for
  the same mask.
- Migration up→down→up round-trips a representative set of masks unchanged
  (`diesel migration run` → `revert` → `run`, per project convention).

## Group B — backend structure

### T10. Session-cookie extraction duplicated across three files
`src/api/graphql.rs:60`, `src/api/images.rs:19`, `src/auth.rs:419/435/441/457` · risk: high

Three implementations of `admin_session` cookie → `AdminSvc::get_session` →
`admin_id`, with **drifted error handling**: `graphql.rs` logs a DB error and
silently downgrades to unauthenticated; `images.rs` surfaces it as
`AppError`/404; `auth.rs` propagates it as `anyhow`.

Add to `src/auth.rs`, next to `check_admin_session`:
`pub const ADMIN_SESSION_COOKIE: &str = "admin_session";` and
`pub fn admin_id_from_jar(context: &GraphQLContext, jar: &CookieJar) -> anyhow::Result<Option<i32>>`
performing `jar.get(ADMIN_SESSION_COOKIE).map(|c| AdminSvc::get_session(context, c.value())).transpose()?.flatten().and_then(|a| a.id)`.

Route all three call sites through it and use the constant at every
`Cookie::build` / `jar.get` / `jar.remove` site.

**Decision required, then applied uniformly:** pick ONE policy for the DB-error
case. Recommended: propagate the error rather than treating a database failure as
"not logged in" — the current `graphql.rs` behaviour means a transient DB fault
silently downgrades an admin to anonymous. Whichever is chosen, state it in the
commit body and pin it with a test.

### T16. `ChoreCompletionSvc::create` — 5 connections, double chore fetch
`src/svc/chore_completion.rs:160-207` · risk: medium

Takes five pool connections and fetches the same chore row twice because
`can_claim_bonus` re-loads it.

Change `ChoreSvc::can_claim_bonus` to accept the already-loaded `&Chore` (or add
`can_claim_bonus_for(chore: &Chore, conn)`), and thread a single
`get_conn(context)?` through the fetch, the cap count, the insert, and the final
read inside one `conn.transaction(…)` — which also closes the check-then-insert
race on capped bonus chores.

Structurally, extract `fn ensure_bonus_claim_allowed(context, chore, chore_id) -> Result<()>`
(lines 167-174) and `fn new_completion(input, amount_cents) -> ChoreCompletion`
(the 14-field literal at lines 185-198), so `create` reads: fetch chore → guard →
compute amount → build row → insert → re-read.

**Characterization tests required** asserting computed `amount_cents` is
unchanged for both Daily and Weekly chores, and that the bonus cap still rejects
the `max_claims + 1`-th claim.

### T17. `UserSvc::balances` — 52 lines, hardcoded budget and kid names
`src/svc/user.rs:81-132` · risk: high

Spans env read, HTTP client config, remote YNAB fetch, group lookup, category
scan, and result assembly.

Extract `fn ynab_configuration() -> Configuration` (lines 82-90) and
`fn kid_balances(group: &CategoryGroupWithCategories) -> Result<Vec<UserBalance>>`.
Replace the three `Option` locals and three `ok_or_else` unwraps (lines 101-116)
with a table-driven loop over
`const KIDS: [(&str, &str); 3] = [("Aurora Cash", "Aurora"), ("Madeline Cash", "Madeline"), ("AJ Cash", "AJ")]`,
so adding a child is a one-line change. Hoist the hardcoded `budget_id` to a
`const YNAB_BUDGET_ID` (or an env var).

This calls a third-party API; tests must not hit the network. Characterize
`kid_balances` as a pure function over a constructed
`CategoryGroupWithCategories`, including the milliunits→dollars conversion
(divide by 1000) and the missing-category error path.

### T13. N+1 on `ChoreCompletion` field resolvers
`src/models.rs:469`, `:481`, `:492` · risk: high

`chore`, `user`, and `notes` each run a separate query and pool checkout per
completion, while `GET_ALL_WEEKLY_COMPLETIONS` requests all three and polls every
30 s.

Add a per-request memo cache on `GraphQLContext` (e.g.
`chores: Arc<Mutex<HashMap<i32, Chore>>>`, same for users) populated on first
miss, or batch-load with a single `eq_any` query keyed off the completion set
before resolving.

**Must land after T14** — the `notes` resolver's visibility argument changes
there, and the batch loader has to carry the corrected gate, not the leaky one.
Characterization tests must assert the resolved values are identical before and
after, including that note visibility still respects `admin_id`.

## Group C — small frontend

### T9. Document `getWeekStartDate`; unexport three helpers
`site/src/utils/dateUtils.ts:3` · risk: low

Add TSDoc on `getWeekStartDate` recording that weeks are Sunday-start (local
time, midnight-normalised), that this is the value sent to the backend as
`weekStartDate`, and that it is deliberately independent of the Monday-first
`requiredDays` bitmask (cross-reference T6).

Drop the `export` keyword from `getWeekStartDate` (:3), `getWeekEndDate` (:12)
and `isSameDay` (:56) — each has exactly two references, the declaration and one
internal caller (`getWeekDateRange` uses the first two, `isSameDayAsString` the
third). No test, story, or component imports them.

## Group D — component extractions

All four carry `risk: high — needs characterization tests first`. These are
presentational React components; characterization means React Testing Library
tests asserting rendered output and handler wiring **before** extraction, so the
extraction is provably behaviour-preserving. Existing tests live in
`site/src/components/__tests__/`.

### T1. `AdminChoreManagement` — 264 lines
`site/src/components/AdminChoreManagement.tsx:17`

Extract: (1) `useUserImages(refetchUsers)` in `site/src/hooks/` returning
`{ uploadImage(userUuid, file), removeImage(userId) }`, absorbing the two raw
`fetch` calls at lines 38-72 and routing them through the existing
`withErrorToast` helper; (2) `<AdminChoreToolbar …/>` for the 4-button block at
lines 115-140; (3) `<ChoreAssignmentModal …/>` for lines 212-252;
(4) `<UserManagementModal …/>` for lines 255-277.

### T4. `ChoreCompletionDetail` — 221 lines
`site/src/components/ChoreCompletionDetail.tsx:21`

Extract `useCompletionActions({ completion, isAdmin, adminId, userId, onUpdate, onClose })`
returning `{ addNote, approve, reject }` for the three `useMutation` blocks and
handlers (lines 33-105); then split the render into `<CompletionSummary/>`
(109-138), `<CompletionNotesList/>` (162-184), and `<AddNoteForm/>` (187-238).

### T3. `AdminPayoutSystem` — 215 lines
`site/src/components/AdminPayoutSystem.tsx:13`

Extract `<PayoutSummaryCards/>` (87-104), `<PayoutUserRow/>` (127-163), and
`<PayoutActionsPanel/>` (174-215). Wrap the `totalUnpaidAmount`/`selectedTotal`
reductions (67-71) in `useMemo` keyed on `[unpaidTotals, selectedUsers]`. Drop
the stale `Recent Activity` placeholder (218-224) or move it to its own component.

### T2. `AdminCompletionReview` — 215 lines
`site/src/components/AdminCompletionReview.tsx:26`

The pending (128-168) and approved (182-213) lists are two copies of the same
card markup, reproducing the existing `CompletionCard.tsx`, which already
supports both variants via `showActions`. **Reuse it** for both loops rather than
creating a new component. Fold in the one cosmetic delta: the pending block uses
`flex md:flex-col gap-2` for its button stack where `CompletionCard.tsx:40` uses
`flex gap-2` — add an optional `actionsLayout?: 'row' | 'stacked'` prop.

Replace the hand-rolled prev/this-week/next trio (93-112) with the existing
`WeekNavigator` component, then trim the now-unused `getPreviousWeek`/
`getNextWeek` imports at :10-17.

### T7. `WeeklyChoreView` — 257 lines
`site/src/components/WeeklyChoreView.tsx:26`

Extract `useIsMobile(breakpoint = 600)` from the resize effect (53-61);
`<BadgeChips badges wrap={isMobile}/>` to collapse the near-identical badge
blocks at 162-177 and 181-196 (they differ only in class:
`overflow-x-auto pb-1 mt-2` vs `flex-wrap mb-4`); `<ChoreGrid/>` and
`<ChoreCardList/>` for the mobile/desktop branches (216-251); and move
`isChoreCompletedByAnyone`/`isChoreCompletedByUser` plus the `completionLookup`
memo into a `useCompletionLookup(allCompletionsData)` hook.

Note this file was edited by the doc-comment commit (`7569caf`) — the
mobile/desktop comment now sits on the `currentDate` memo. Preserve that.

---

## Per-task contract

1. Read the finding (file:line, proposed fix, risk).
2. If `risk: high`, write characterization tests first, confirm green on
   unchanged code, commit as `test: characterize <unit> before tidy [T<n>]`.
3. Apply the change.
4. Run lint / typecheck / format. Fix warnings the change introduced; leave the
   documented preexisting baseline alone.
5. At every group boundary or 5 findings, run the full suite.
6. Commit as `tidy(<lens>): <summary> [T<n>]`.
7. **Strip the finding from `TIDY.md` in the same commit.** Non-negotiable.
   (`TIDY.md` is listed in `.git/info/exclude`, so it is not tracked — "strip"
   means edit the working file, and note the removal in the commit body.)

## Out of scope

- `T11` (dead `pub struct Claims`) and `T12` (unauthenticated
  `create_chore_completion`) — left unchecked, remain in `TIDY.md`.
- `T15` (weekly rounding remainder) — explicitly skipped, recorded in memory.
- All medium and low severity findings — remain in `TIDY.md`.
- Renames and public-API signature changes stay disabled; if a fix requires one,
  convert it to a `decision-needed` marker in `TIDY.md` and skip it.
