# Tidy execution — dead code, duplication, and idiom cleanup (2026-08-22)

Execution spec for the 30 findings Steve marked `[x] execute` in `TIDY.md`.

## Provenance and a standing caution

`TIDY.md` was triaged on **2026-08-04 against `b59bb45`**. Since then the
availability-window, assignee-filter, and pending-totals work landed (through
`86965df`). **Every line number in this spec is from the stale triage.** Each
task must re-locate its target by symbol name before editing, and if a finding
no longer applies, record that in the commit body rather than forcing the edit.

`T6` is referenced by `T35` but is absent from `TIDY.md` — it was executed and
stripped in the 2026-08-05 pass, leaving `site/src/utils/weekdayBitmask.ts`.
`T35` consumes that module; it must not re-implement the day convention.

## Baseline (verified green on `tidy/2026-08-22` @ `86965df`)

| Check | Result |
| --- | --- |
| `cargo build` | clean |
| `cargo clippy --all-targets` | 9 pre-existing warnings, no errors |
| `cargo test` | all pass (incl. 2 doctests) |
| `yarn lint` (site) | clean at `--max-warnings 0` |
| `yarn build` (site) | clean |
| `yarn test` (site) | 21 files, 151 tests pass |

Pre-existing clippy warnings are **not** in scope. A task fixes only warnings its
own change introduces.

**Toolchain note:** `yarn` is not on the default `PATH`. It lives under node
v24.19.0; every frontend command in this spec must be run as:

```
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
```

`node_modules` were absent at the start of this pass and were installed with
`yarn install` at both the repo root and in `site/`.

## Decisions taken before execution

Steve resolved three ambiguities that the findings themselves flagged:

1. **T36 vs T41** — `NavItem.tsx` is **deleted** (T36). T41 builds a fresh
   `AdminNav` from PageTemplate's existing button markup. NavItem is an
   `<li><Link>` with white text and no active state; it shares no styling with
   the nav it would have replaced.
2. **T26 polling** — accepted. `AdminCompletionReview` gains
   `fetchPolicy: 'cache-and-network'` and a 30 s poll by adopting
   `useWeeklyCompletions`. This matches T37's fix to the sibling query.
3. **T42 rename** — approved despite tidy's default rename policy.
   `formatCents` / `formatDollars` replace the two same-named `formatCurrency`
   implementations.

## Invariants this work depends on

Per the repo's spec discipline, the invariants below are load-bearing. Any task
that leans on one must pin it with a test rather than cite it in prose.

- **Money units.** Every money field on the wire is **cents**. The YNAB-sourced
  `UserBalance.balance` is **whole dollars** and is joined **by name**, not id.
  T42 depends on this and must pin it with tests for both entry points.
- **Weekday bitmask.** `1=Mon … 64=Sun` on the backend.
  `site/src/utils/weekdayBitmask.ts` owns the client encoding. T35 depends on it.
  Note the known data bug: stored `requiredDays` rows use Sunday=1. T35 must not
  change the convention in either direction — it is a pure de-duplication.
- **Completion-window enforcement.** `ChoreCompletionSvc::create` is the only
  path that inserts a completion row and the only enforcement point for
  availability windows. T55/T56 touch resolvers near this path and must not move
  or weaken that guard.
- **`withErrorToast` toasts on failure.** T31 depends on which callees already
  toast; the double-toast bug exists precisely because that was assumed rather
  than checked. Each of the eight sites must be read before it is rewritten.

## Task groups

Grouped so that each group is independently revertable and hits a natural test
milestone. Ordering matters only where noted.

### Group A — Dependency removal (T18, T19, T20, T21, T22, T23)

Pure deletions from manifests. All six were verified by `cargo machete` /
`grep` at triage time and must be **re-verified** before deletion.

- **T18** — drop `chrono-tz` from `Cargo.toml`.
- **T19** — drop `axum-embed` from `Cargo.toml`.
- **T20** — drop `react-router` from `site/package.json` (every import is from
  `react-router-dom`, which depends on it transitively).
- **T21** — drop `rxjs` from `site/package.json`.
- **T22** — drop eight never-loaded eslint configs/plugins, **and** delete the
  now-inert `n/*`, `node/*`, `react/*` rule entries in `site/eslint.config.js`
  whose owning plugins are never registered. Keep exactly what the flat config
  imports: `@eslint/js`, `globals`, `eslint-plugin-react-hooks`,
  `eslint-plugin-jsx-a11y`, `eslint-plugin-react-refresh`, `typescript-eslint`,
  `eslint-config-prettier`, `eslint-plugin-prettier`.
- **T23** — drop `stylelint`, `stylelint-config-standard`, `prettier-eslint`.
  Keep `prettier` and `eslint-plugin-prettier`.

Corroboration: the `yarn install` at the start of this pass emitted peer-dep
warnings from `eslint-config-standard`, `eslint-plugin-import`,
`eslint-plugin-react`, and `eslint-plugin-jsx-a11y` — the T22 set.

**Verification:** re-run `yarn install` after the JSON edits, then `yarn lint`
(must stay clean at `--max-warnings 0`), `yarn build`, `yarn test`, plus
`cargo build` and `cargo test` for T18/T19.

### Group B — Backend dead code and idioms (T44, T45, T46, T47, T57)

- **T44 + T45 + T46** — one commit each is overkill for three deletions in the
  same 27-line file, but the per-finding commit rule stands; delete
  `api_routes`, then `test`, then `err_wrapper<T>`. The `use serde::Serialize;`
  and `use axum::Json;` imports die with `err_wrapper` and must go in that
  commit.
- **T47** — replace the string-matching status selection in
  `AppError::into_response`. Add a `pub struct Unauthorized;` marker implementing
  `Display` + `std::error::Error`, select `StatusCode::UNAUTHORIZED` via
  `self.0.downcast_ref::<Unauthorized>().is_some()`, and construct it as
  `AppError(anyhow!(Unauthorized))` in `src/api/images.rs`.

  This is a behavior-preserving change **only if** every current
  message-match site is converted. Write a test that a wrapped `Unauthorized`
  still yields 401 after `.context("…")` is prepended — that is the bug the
  finding names, and it is exactly the kind of unguarded-invariant test the
  repo's spec discipline says not to skip.
- **T57** — add `pub const MAX_UPLOAD_BODY_SIZE: usize = MAX_IMAGE_SIZE + 1024 * 1024;`
  to `src/api/images.rs` with a doc comment explaining the multipart envelope
  overhead; use it in `src/routes.rs`'s `RequestBodyLimitLayer::new(...)`.

### Group C — Backend query efficiency (T55, T56)

Both are `risk: high` in the sense that they change how data is fetched.
**Characterization tests first**, per the per-task contract.

- **T55** — `User::image_path` issues one `user_images` query per user, fanning
  out to chores × users on nested selections. Prefer the option that removes the
  query outright: serve `/images/user/{id}` from the `image_id` column already
  loaded on `User` (the route exists at `src/api/images.rs:35`). Fall back to a
  `user_id.eq_any(ids)` batch cached on `GraphQLContext` if the column turns out
  not to carry enough information.
- **T56** — replace `Chore::assigned_users`'s two queries with a delegation to
  `ChoreSvc::get_assigned_users`, which already does the
  `chore_assignments INNER JOIN users` in one query. Drop the now-unused
  `assignments` / `user_ids` locals and their `debug!`.

Characterization tests must assert the **resolved output** (same users, same
order, same image paths) before and after, not the query count.

### Group D — Backend authorization surface (T52)

- **T52** — `createChoreCompletionNote` requires admin, but the kid-facing
  completion-detail modal shows an Add Note button that always errors for
  unauthenticated users. Steve's note on the finding settles the direction:
  **make it admin-only**. Gate the `+ Add Note` button and its form on `isAdmin`
  in `site/src/components/ChoreCompletionDetail.tsx`. Do **not** relax the
  resolver.

### Group E — Frontend dead code (T28, T29, T30, T34, T36)

- **T28** — delete `site/src/components/BorderedTableCell.tsx` outright.
- **T29** — delete `getVariant` from `Button/ButtonTypes.ts`. Keep
  `export enum ButtonTypes` (13 live references).
- **T30** — delete the three commented-out clsx entries in `Button/index.tsx`
  (`// 'text-black',`, `// getVariant(type, disabled),`, `// block && 'w-full',`).
  Pairs with T29 — the commented `getVariant` line is one of the three.
- **T34** — replace the `any`-typed `onSubmit` prop in `CreateChoreForm` with
  `(choreData: ChoreInput, selectedUserIds: number[]) => Promise<void>`, and type
  `initialChore?: Chore`. Import from `types/chore`.
- **T36** — delete `site/src/components/NavItem.tsx` (see decision 1).

### Group F — Frontend duplication (T31, T39, T40, T42, T38)

- **T31** — route eight hand-written try/catch + toast wrappers through
  `withErrorToast`. **Read each call site first**: `AdminChoreManagement.tsx`'s
  `handleAssignUser`/`handleUnassignUser` and `WeeklyChoreView.tsx`'s completion
  handler call into hooks that *already* toast, so wrapping them is what produced
  the live double-toast bug. Those two are deletions, not rewrites — pass the
  hook functions straight through, keeping only `WeeklyChoreView`'s
  `refetchAllCompletions()` side effect. Fixing the double-toast is a
  user-visible behavior change and needs a test.
- **T39** — add `site/src/hooks/useErrorToast.ts` and replace the verbatim
  error-toast effect in `useBalances`, `useBonusChores`, `useUserBadges`.
  Drop each file's now-unused `useEffect` / `toast` imports.
- **T40** — add `site/src/page/RequireAdmin.tsx` exporting the shared
  `OutletContext` interface plus a `RequireAdmin` component with a local
  `AccessDenied`. Collapse the three admin page files. Route the login button
  (and `AdminHomePanel.tsx`'s matching one) through the existing `Button`.
- **T42** — new `site/src/utils/currency.ts` with `formatCents(amountCents)` and
  `formatDollars(amount, opts?: { zeroAs?: string })` sharing one
  `Intl.NumberFormat`. **Do not collapse them into one function** — the
  cents/dollars split is load-bearing. Give each a TSDoc naming its unit. Update
  the seven `formatCurrency` importers and replace `UserBalance.tsx`'s local copy
  with `formatDollars(userBalance.balance, { zeroAs: '-' })`. Unit-test both.
- **T38** — declare `UserSummary`, `ChoreSummary`, `NoteFields`,
  `CompletionFields` gql fragments at the top of `site/src/graphql/queries.ts`
  and interpolate them. **Keep deliberately narrow selections inline** —
  `GET_ALL_WEEKLY_COMPLETIONS` asks for only `chore { id uuid name }` and must
  not be widened, or payloads grow. Leave `GET_USER` alone: it is unused and
  belongs to T80, which is not in this batch.

### Group G — Frontend structure (T26, T27, T32, T35, T37, T41)

Ordering: **T26 before T27** (the finding says so).

- **T26** — replace `AdminCompletionReview`'s hand-rolled
  query/mutation/refetch/split with the existing zero-importer
  `useWeeklyCompletions` hook. The hook must absorb one delta: an
  `onMutated?: () => void` option so the component can clear
  `selectedCompletion` after approve/delete. Keep the `confirm()` guard on the
  reject path. Delete the redundant local `completions.filter(...)`. Polling is
  accepted (decision 2).
- **T27** — replace the twice-inlined completion-card markup with the existing
  zero-importer `CompletionCard`. Fold in an optional
  `actionsLayout?: 'row' | 'stacked'` prop for the pending variant's
  `flex md:flex-col gap-2` button stack.
- **T32** — promote the 72-line `renderChoreCell` to a `<ChoreCell />` component
  in its own file, with the four cell states as guard-clause early returns.
  Hoist `getCompletionNotes` to a module-level
  `notesTooltip(completion: ChoreCompletion | null): string`. Hoist the
  claim-then-confetti handler into a shared helper — this is the same hoist T75
  asks for. **T75 is not in this batch**, so do the `ChoreRow` half only and
  leave `BonusChoreSection` and the badge-chip duplication for T75.
- **T35** — replace the seven hand-written `requiredDays & <literal>` tests in
  `CreateChoreForm`'s edit-mode effect, and the reduce in `handleSubmit`, with
  the helpers from `site/src/utils/weekdayBitmask.ts` (created by T6). **Do not
  re-implement the day convention.**
- **T37** — give `GET_ALL_WEEKLY_COMPLETIONS`'s `useQuery` in `WeeklyChoreView`
  the same options as its siblings: `fetchPolicy: 'cache-and-network'`,
  `pollInterval: 30_000`.
- **T41** — extract `ADMIN_NAV_ITEMS` + an `<AdminNav items pathname onNavigate />`
  (replacing the three copy-pasted buttons), a `useAdminSession()` hook (from the
  inline auth bootstrapping plus module-level `checkAdminSession`), and an
  `<AppHeader />`, leaving `PageTemplate` as header + Outlet + Footer.

## Out of scope

- **T15** — skipped by Steve; already recorded in the tidy skip-list memory.
- **T75, T80** — left unchecked in `TIDY.md`; T32 and T38 must not absorb them.
- Every other unchecked finding stays in `TIDY.md` for the next pass.
- Pre-existing clippy warnings and the frontend chunk-size warning.

## Per-task contract

From the tidy skill, non-negotiable:

1. Re-locate the finding by symbol name (line numbers are stale).
2. If `risk: high`, write characterization tests first, confirm they pass
   **unchanged**, and commit as `test: characterize <unit> before tidy [T<n>]`.
3. Apply the change.
4. Run lint / typecheck / format; fix only warnings this change introduced.
5. At each group boundary (or every 5 findings), run the full suite. On red:
   bisect within the group, revert the offender, surface the diagnosis.
6. Commit as `tidy(<lens>): <summary> [T<n>]`.
7. **Strip the finding from `TIDY.md` in the same commit.** Non-negotiable.

## Definition of done

- 30 findings applied or explicitly recorded as no-longer-applicable.
- `TIDY.md` contains none of them, and still contains every unchecked finding.
- `cargo build`, `cargo clippy`, `cargo test` at or better than baseline.
- `yarn lint` clean at `--max-warnings 0`, `yarn build` clean, `yarn test` ≥ 151
  passing (new tests expected from T31, T42, T47, T55, T56).
