# Tidy execution spec — follow-up batch (2026-08-05)

Source: `TIDY.md`. Selected by Steve: T103, T104, T106, T107, T108 checked
`[x] execute`, plus **T105 added on Steve's instruction** because T104 removes one
of the three guards that currently make T105's latent issue unreachable.

Working **directly on `main`** (Steve's choice). `main` is currently 33 commits
ahead of `origin/main` and nothing is pushed.

`T15` remains `[x] skip` and is already recorded in user memory — do not re-flag.

## Toolchain

| | Rust | Frontend (from `site/`) |
|---|---|---|
| build | `cargo build` | `yarn build` |
| test | `cargo test` | `CI=true yarn test` |
| lint | `cargo clippy --all-targets` | `yarn lint` |
| format | `rustfmt --edition 2024 <file>` | prettier via lint-staged |

**Verified baselines on the clean tree at `408e812`:** clippy exactly **10**
warnings; `cargo fmt --check` exactly **11** diffs; 76 Rust lib tests + 6
integration/doctests pass; 86 frontend tests across 13 files pass; `yarn lint`
and both builds clean.

- **Never run bare `cargo fmt`** — the 11 pre-existing diffs must not be swept
  into a commit. Format only edited files, then `git diff --stat` to confirm.
- **Never pass `-D warnings`.** Add no new warnings; fix none of the baseline.
- The husky pre-commit hook IS active and runs `cd site && npx lint-staged && CI=true yarn test`.
  It runs the frontend suite only — it will not catch Rust breakage.
- `site/src/App.test.tsx` is known-flaky under CPU load; reproduces on an
  untouched tree. If only that fails, re-run before concluding regression.

## Line numbers are stale

Every finding here was recorded before the 2026-08-04 batch landed 33 commits.
`src/svc/chore_completion.rs` in particular was restructured by T16 — the
14-field `ChoreCompletion` struct literal T103 refers to was extracted into a
`new_completion` helper, so it is no longer at the quoted line.

**Locate every symbol with `grep -n`. Never trust a quoted line number.**

## Invariants this batch depends on

1. **`approved_at` is written only alongside `approved = true`**, and "reject" is
   `deleteChoreCompletion` — there is no unapprove path. T105 converts reliance on
   this from implicit to explicit. Pinned by T105's test.
2. **Per-request `GraphQLContext`** — `custom_graphql` constructs a fresh context
   per HTTP request so `chore_cache`/`user_cache` never span callers. T106 pins the
   keying half of this.
3. **Subscriptions are `EmptySubscription`** — nothing is resolvable over the
   websocket, which is the only reason the untested subscription path is safe.
   T108 converts this from prose into an assertion.

## Ordering

- **T104 before T105.** T104 makes `approvedAt` reachable in the payload; T105's
  test is only meaningful once a pending completion can actually carry one.
- The rest are independent. Suggested order: T103, T106, T108 (Rust), then T104,
  T105, T107 (frontend).

---

## T103. Drop a needless clone — `completion_input.uuid`
`src/svc/chore_completion.rs` · risk: low · lens: idioms

The `ChoreCompletion` construction clones `completion_input.uuid` even though
`completion_input` is never read afterwards and its remaining read fields are all
`Copy`.

**The finding's suggested fix cannot be applied verbatim.** It reads
`uuid: uuid_or_generate(completion_input.uuid),` and is annotated "(Do with T93,
which imports `uuid_or_generate` in this file.)" — **T93 was not selected.**
Without it there is no module-level `uuid_or_generate` import.

**Scope for this task:** remove the `.clone()` only. Keep whatever call path is
already in the source (`crate::uuid_or_generate(...)` or equivalent). Do **not**
add the module-level import — that is T93's content and remains unselected.

Find it by symbol: the `uuid:` field of the `ChoreCompletion` literal, which now
lives in the `new_completion` helper extracted by T16.

If removing the clone does not compile because `completion_input` is borrowed
rather than owned at that point, stop and report rather than changing the
helper's signature — that would be a public-API change, which is disabled.

**Verification:** `cargo build`, `cargo test`, clippy still exactly 10.

## T104. Fetch `approvedAt` in `GET_ALL_WEEKLY_COMPLETIONS`
`site/src/graphql/queries.ts` · risk: low · lens: opportunistic

The query selects `approved` but not `approvedAt`. Apollo strips fields outside
the selection set, so `completion.approvedAt` is always `undefined` for every
completion delivered through this query, and `CompletionCard`'s
`{completion.approvedAt && …}` line has never rendered in the admin review
screen. Pre-existing; discovered during the 2026-08-04 batch and verified
independently.

Add `approvedAt` to the selection set.

**Verification:** a test asserting an *approved* completion delivered through
this query renders its "Approved: \<date\>" line — i.e. prove the line now
renders, which is the whole point. `site/src/components/__tests__/AdminCompletionReview.test.tsx`
already exercises this screen and is the natural home.

## T105. Gate the "Approved" line explicitly
`site/src/components/CompletionCard.tsx` · risk: medium · lens: opportunistic

`CompletionCard` renders `{completion.approvedAt && <p>Approved: …</p>}` for
every usage including pending cards, where the pre-refactor inline markup had no
such JSX. It is unreachable only via three invariants; **T104 removes one of
them.**

Change the condition to require approval explicitly — gate on
`completion.approved && completion.approvedAt` (keeping the `approvedAt` check so
a null date still renders nothing).

**Verification (required, both):**
- A pending completion carrying a non-null `approvedAt` renders NO "Approved"
  line. This is the case the three invariants used to make impossible and which
  nothing currently pins.
- An approved completion with an `approvedAt` still renders its line — i.e. the
  gate did not break the real path.

Must land after T104.

## T106. Make the cache test distinguish correct keying from mis-keying
`src/models.rs` · risk: low · lens: opportunistic

`batched_resolvers_return_the_same_values_as_before` uses ONE chore and ONE user
across three completions, so a cache mis-keyed in a way that still resolves the
same singleton row passes. The final whole-branch review flagged this as the
highest-value cheap hardening available.

Give it **at least two distinct chores and two distinct users, interleaved across
completions**, and assert each completion resolves ITS OWN chore and user — not
merely that resolution succeeds.

**Prove it bites:** temporarily mis-key the cache (e.g. have `cached_by_id` key on
a constant instead of the id), confirm the strengthened test FAILS, restore
exactly, confirm with `git diff --exit-code`. Report the observation.

Mind the `max_size(1)` test pool — hold only one connection at a time.

## T107. Exercise `isChoreCompletedByUser`
`site/src/hooks/useCompletionLookup.ts` · risk: low · lens: opportunistic

The predicate is only called from `BonusChoreSection`, and every existing test
fixture mocks `listBonusChores: []`, so the component early-returns before
reaching it. It was moved byte-identical during T7 and is not suspect — but it is
entirely unguarded.

Add a fixture with a **non-empty** `listBonusChores` and assert both states: a
bonus chore the user HAS completed, and one they have NOT. The completed/not
distinction is the predicate's whole job, so a test covering only one state
proves little.

Note the predicate recomputes `formatDateForGraphQL(date)` inside its comparison
and linearly scans — that inefficiency is a separate unselected finding.
**Test it as-is; do not optimise it.**

## T108. Pin that subscriptions are still `EmptySubscription`
`src/api/graphql.rs` / `src/graphql.rs` · risk: medium · lens: opportunistic

**The finding as written is not directly actionable** — its two options are "add
a websocket test harness" (substantial; a feature, not a tidy item) or "leave
`EmptySubscription` in place" (a no-op). Steve has been told this task takes the
proportionate third reading:

**Add a test asserting the GraphQL schema's subscription type is still
`EmptySubscription`** (or that no subscription field is resolvable). The moment
someone adds a real subscription, that test fails and forces them to confront the
fact that no websocket harness exists — converting the invariant the current
safety rests on into an executable guard.

Also add a short comment at the `custom_subscriptions` handler recording *why*
the missing coverage is currently tolerable (nothing is resolvable) and what must
happen before a real subscription is added.

Do **not** build a websocket test harness in this task. Do **not** change
`EmptySubscription` to anything else.

**Verification:** the new test passes now; confirm by inspection that it would
fail if the schema's subscription root gained a resolvable field.

---

## Per-task contract

1. Read the finding. Locate symbols with `grep -n` — quoted lines are stale.
2. Apply the change.
3. Run lint / typecheck / format on edited files only.
4. Run the full suite for the affected stack.
5. Commit as `tidy(<lens>): <summary> [T<n>]`.
6. **Strip the finding from `TIDY.md` in the same commit.** `TIDY.md` is
   UNTRACKED (`.git/info/exclude`) — edit the working file, do NOT `git add` it,
   and record the removal in the commit body.
7. Stage only changed files. Never `git add -A`.

## Final verification

- `cargo build`, `cargo test`, `cargo clippy --all-targets` (expect exactly 10).
- `cargo fmt -- --check` (expect exactly 11 — unchanged).
- From `site/`: `yarn lint`, `yarn build`, `CI=true yarn test`.
- `TIDY.md` should drop from 94 findings to **88** (six stripped), with T15's
  `[x] skip` still present.

## Out of scope

- `T93` (module-level `uuid_or_generate` import) — unselected; T103 must not pull
  it in.
- Building a websocket test harness — see T108.
- Optimising `isChoreCompletedByUser` — see T107.
- The 11 pre-existing `cargo fmt` diffs.
- All other 88 findings in `TIDY.md`.
