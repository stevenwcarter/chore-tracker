# TIDY.md — code cleanup findings

Last triage: 2026-08-04 against `tidy/2026-08-04` @ b59bb45. Toolchain: cargo build + yarn build / cargo clippy --all-targets + yarn lint / cargo test + yarn test.

> **For future sessions reading this file:** when you fix an item listed
> here, strip it from this file in the same commit that fixes it. The list
> is intended to reflect open issues only; resolved items shouldn't linger.
> This keeps the file's signal-to-noise high for the next tidy pass.

## How to use this file
- Check `[x] execute` on items to run this batch.
- Check `[x] skip` on items to never re-flag (the skill records them in user memory).
- Items left unchecked stay in TIDY.md for the next run.
- When ready, run `/tidy --execute`.

## High severity

### T11. Dead claims type sitting in the OIDC auth path invites being wired up in place of the validated one: `pub struct Claims` (src/auth.rs:14-23)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete `pub struct Claims` and its derive (src/auth.rs:14-23). Verified: `git grep -w Claims` over src/, tests/, site/, migrations/, .github/ finds only the definition; the actual JWT decode at src/auth.rs:164-168 uses the function-local `struct IdTokenClaims`. Flagged high severity because a stale, unused claims type in an auth module invites someone to wire it up in place of the validated one.
- [ ] execute   [ ] skip

### T12. Only unauthenticated mutation in the schema has no duplicate, assignment or future-date check and no doc explaining why it is open: `create_chore_completion` (src/graphql.rs:241-244)
- Lenses: opportunistic, comments
- Risk: high — needs characterization tests first
- Proposed fix: _(flag-only — no auto-fix proposed; escalate to /code-health for a deeper look)_ — `createChoreCompletion` is unauthenticated and performs no duplicate, assignment, or future-date check, so repeated calls mint unlimited unpaid balance. In the meantime, document (comments lens) that this is deliberately the only mutation without `require_admin` — kids mark their own chores done — that the payout amount is computed server-side and never accepted from the client, and that the record is created unapproved.
- [ ] execute   [ ] skip

### T15. Weekly per-day amount is rounded to the nearest quarter with no remainder distribution, so the week's total does not equal the chore amount: `calculate_completion_amount` (src/models.rs:553)
- Lenses: opportunistic
- Risk: high — needs characterization tests first
- Proposed fix: _(flag-only — no auto-fix proposed; escalate to /code-health for a deeper look)_
- [ ] execute   [x] skip

## Medium severity

### T21. Runtime dependency with no import anywhere in the frontend: `rxjs` (site/package.json:30)
- Lenses: dead-code
- Risk: high — needs characterization tests first
- Proposed fix: Remove `"rxjs": "^7.8.2"` from site/package.json dependencies and re-run yarn install. Verified: `grep -rn 'rxjs|Observable|Subject'` over site/src .ts/.tsx returns only false positives on the substring `oidcSubject`; nothing imports from 'rxjs'. State is handled by Apollo Client and React hooks.
- [x] execute   [ ] skip

### T24. Raw fetch + try/catch + toast boilerplate duplicated in a component, against the hooks convention: `handleImageUpload` / `handleRemoveImage` (site/src/components/AdminChoreManagement.tsx:38-72)
- Lenses: duplication, idioms
- Risk: low
- Proposed fix: `handleImageUpload` (:38-56) and `handleRemoveImage` (:58-72) repeat the same fetch -> `if (response.ok) refetchUsers() else toast.error` -> `catch { toast.error }` skeleton with only the URL, method, body and two message strings differing; raw fetch in a component also violates the project convention that every data call goes through a hook in site/src/hooks/ with the `withErrorToast` helper (same violation at site/src/page/PageTemplate.tsx:10). Add site/src/utils/imageApi.ts with `uploadUserImage(userUuid, file)` and `deleteUserImage(userId)`, each doing the fetch and throwing on `!response.ok`; wrap them in site/src/hooks/useUserImages.ts exporting `useUserImages(refetchUsers)` with `uploadImage(userUuid, file)` and `removeImage(userId)` built on the existing `withErrorToast` helper, and consume that hook from AdminChoreManagement.tsx. Folds the 'Failed to …' / 'Error …' message pair into one message per operation. (Do after T31 so `withErrorToast` usage is already normalised; this is the same hook T1 extracts.)
- [ ] execute   [ ] skip

### T25. Two-line loading/error guard repeated in five components: query gate (site/src/components/AdminChoreManagement.tsx:105-106)
- Lenses: duplication
- Risk: low
- Proposed fix: The two-line loading-spinner / error-div guard is repeated at AdminChoreManagement.tsx:105-106, AdminCompletionReview.tsx:82-83, AdminPayoutSystem.tsx:64-65, UserSelector.tsx:23-24, WeeklyChoreView.tsx:133-135 — five copies of the same class string with only the noun varying. Add site/src/components/QueryGate.tsx taking `{ loading, error, subject, children }` and rendering LoadingSpinner / the red error div / children. Wrap the returned JSX at the five call sites and delete the guard lines. Note UserSelector.tsx:26 reads `data?.listUsers` after the guard, so keep that derivation inside the wrapped subtree or above the return.
- [ ] execute   [ ] skip

### T26. Component hand-rolls the query/mutation/refetch/split logic an existing hook already implements: `AdminCompletionReview` data layer (site/src/components/AdminCompletionReview.tsx:32-87)
- Lenses: duplication
- Risk: medium
- Proposed fix: AdminCompletionReview.tsx:32-87 hand-rolls the exact query/mutation/refetch/pending-vs-approved-split logic that site/src/hooks/useWeeklyCompletions.ts:17-61 already implements, and that hook has zero importers anywhere in site/src. Replace the block with the `useWeeklyCompletions` hook and delete the local useQuery/useMutation declarations plus `handleApproveCompletion`/`handleRejectCompletion` (keeping the `confirm()` guard in the reject path). Two deltas the hook must absorb: clearing `selectedCompletion` after approve/delete (add an `onMutated?: () => void` option), and it sets `fetchPolicy: 'cache-and-network'` + `pollInterval: 30_000` which the component currently does not — confirm polling is acceptable here. Also delete the now-redundant local `completions.filter(...)` at :86-87.
- [x] execute   [ ] skip

### T27. Completion-card markup inlined twice, reproducing an existing zero-importer component: `CompletionCard` (site/src/components/AdminCompletionReview.tsx:128-168 and :182-213)
- Lenses: duplication
- Risk: medium
- Proposed fix: Replace :128-168 with `<CompletionCard ... showActions />` and :182-213 with `<CompletionCard ... />`, adding the import (site/src/components/CompletionCard.tsx:13-71 already supports both variants via `showActions` and has zero importers in site/src). Two cosmetic deltas to fold into CompletionCard: the pending block uses `flex md:flex-col gap-2` for its button stack where CompletionCard.tsx:40 uses `flex gap-2` — add an optional `actionsLayout?: 'row' | 'stacked'` prop; and CompletionCard always renders the `approvedAt` line, which the pending variant never has data for anyway. (Do after T26.)
- [x] execute   [ ] skip

### T28. Component file imported by nothing, including Storybook: `BorderedTableCell` (site/src/components/BorderedTableCell.tsx:1)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete the whole file site/src/components/BorderedTableCell.tsx. Verified: `grep -rn '\bBorderedTableCell\b'` across all of site/src (including stories/, __tests__/ and upgrade-tests/) returns only line 1 of its own definition; no story file references it. git log shows it has existed unused since the initial commit dec98da (2025-05-20).
- [x] execute   [ ] skip

### T29. Exported helper whose only reference is a commented-out line: `getVariant` (site/src/components/Button/ButtonTypes.ts:10)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete `export const getVariant` (site/src/components/Button/ButtonTypes.ts:10 to end of function) together with the commented `// getVariant(type, disabled),` at site/src/components/Button/index.tsx:40. Verified: `grep -rn '\bgetVariant\b'` across site/src returns exactly those two lines. Keep `export enum ButtonTypes` — it has 13 live references. (Pairs with T30, which removes that commented line.)
- [x] execute   [ ] skip

### T30. Three commented-out clsx entries unchanged since 2025-05-20: `MyButton` class list (site/src/components/Button/index.tsx:24, :40-41)
- Lenses: comments, dead-code
- Risk: low
- Proposed fix: Delete the commented lines site/src/components/Button/index.tsx:24 (`// 'text-black',`), :40 (`// getVariant(type, disabled),`) and :41 (`// block && 'w-full',`). The `getVariant` reference points at a helper that is itself dead (T29) and the block-width rule is dead. Verified with `git blame -L 22,42` -> all attributed to the initial commit dec98da, 2025-05-20 (>30 days).
- [x] execute   [ ] skip

### T31. Hand-written try/catch + toast wrappers duplicate `withErrorToast` at eight sites and have drifted into a double-toast bug: mutation error handling (site/src/components/ChoreCompletionDetail.tsx:55)
- Lenses: duplication
- Risk: medium
- Proposed fix: Hand-written try/catch + toast.error wrappers duplicate site/src/utils/withErrorToast.ts:3-10 at eight sites (ChoreCompletionDetail.tsx:55-73, :75-87, :89-105; AdminCompletionReview.tsx:54-64, :66-80; AdminPayoutSystem.tsx:50-62; AdminChoreManagement.tsx:74-80, :82-88; CreateUserForm.tsx:16-29; WeeklyChoreView.tsx:86-93) and the copies have already drifted into a DOUBLE-TOAST BUG at AdminChoreManagement.tsx:74-88, whose assignUser/unassignUser callees already call `withErrorToast` (site/src/hooks/useAdminChoreManagement.ts:78-86). Route every listed site through `withErrorToast(message, () => mutate({ variables }))`. Delete AdminChoreManagement.tsx:74-88 `handleAssignUser`/`handleUnassignUser` entirely and pass the hook's assignUser/unassignUser straight through — they already toast, so the local wrapper only produces a second toast. Same for WeeklyChoreView.tsx:86-93, whose `completeChore` comes from useUserChores.ts:60-71 already wrapped (keep only the `refetchAllCompletions()` side effect). Audit each call site for whether the callee already toasts before wrapping.
- [x] execute   [ ] skip

### T32. 72-line inline render function defining two closures and dispatching over four cell states: `renderChoreCell` (site/src/components/ChoreRow.tsx:42-113, 72 lines)
- Lenses: long-methods
- Risk: high — needs characterization tests first
- Proposed fix: Promote it to a `<ChoreCell chore date completion isScheduled isCompletedByAnyone onSelectCompletion onCompleteChore />` component in its own file, with the four states as guard-clause early returns (`not scheduled` -> spacer, `own completion` -> status pill, `completed by someone else` -> grey check, default -> claim button). Hoist `getCompletionNotes` to a module-level `notesTooltip(completion: ChoreCompletion | null): string` and `handleComplete` to a `useCompleteWithConfetti(onCompleteChore)` hook so ChoreRow itself is just the two layout branches. (The confetti hoist is the same one T75 asks for.)
- [x] execute   [ ] skip

### T33. UTC date default makes the bonus date and `min` attribute jump to tomorrow after ~5pm local: `new Date().toISOString().split('T')[0]` (site/src/components/CreateBonusChoreForm.tsx:15)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: Use the existing local-time helper: `const today = formatDateForGraphQL(new Date())` from utils/dateUtils (which the rest of the app already uses for exactly this reason, see its comment at site/src/utils/dateUtils.ts:35).
- [ ] execute   [ ] skip

### T34. `any`-typed prop even though the only caller already types its handler: `onSubmit` (site/src/components/CreateChoreForm.tsx:7)
- Lenses: idioms
- Risk: low
- Proposed fix: `import { ChoreInput, PaymentType, User, Chore } from 'types/chore';` then type `onSubmit` as `(choreData: ChoreInput, selectedUserIds: number[]) => Promise<void>` and `initialChore?: Chore`.
- [x] execute   [ ] skip

### T35. Seven hand-written `requiredDays & <literal>` tests duplicate the DAYS map declared 30 lines above: edit-mode useEffect (site/src/components/CreateChoreForm.tsx:41, decode at :51-57)
- Lenses: long-methods, idioms
- Risk: high — needs characterization tests first
- Proposed fix: Add pure helpers next to `DAYS`: `const daysFromBitmask = (mask: number): string[] => Object.entries(DAYS).filter(([, bit]) => (mask & bit) !== 0).map(([day]) => day)` and `const bitmaskFromDays = (days: string[]): number => days.reduce((acc, d) => acc + (DAYS[d as keyof typeof DAYS] ?? 0), 0)` — or better, take them from the shared module T6 creates, in which case the effect becomes `setSelectedDays(bitmaskToDays(initialChore.requiredDays || 0))` and handleSubmit's reduce at lines 68-71 becomes `daysToBitmask(selectedDays as DayName[])`, which also removes the `DAYS[day as keyof typeof DAYS] ?? 0` cast at line 68. Both helpers are directly unit-testable. **Do this as part of / after T6 — do not re-implement the Sunday=1 convention.**
- [x] execute   [ ] skip

### T36. Component and its props interface are never imported — PageTemplate builds its nav inline: `NavItem` (site/src/components/NavItem.tsx:7)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete the whole file site/src/components/NavItem.tsx (component, NavItemProps interface and default export). Verified: `grep -rn '\bNavItem\b'` across site/src matches only lines 3/7/22 of NavItem.tsx itself; there is no NavItem story, and site/src/page/PageTemplate.tsx renders its own `<Link>` markup. Untouched since the initial commit dec98da (2025-05-20). (T41 proposes reusing it instead — pick one; deletion is the default unless T41 is executed.)
- [x] execute   [ ] skip

### T37. Sibling query has no fetchPolicy or pollInterval while its partner polls every 30s, so 'completed by someone else' ticks go stale: `GET_ALL_WEEKLY_COMPLETIONS` useQuery (site/src/components/WeeklyChoreView.tsx:78)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: Give this useQuery the same options as the other weekly consumers: `fetchPolicy: 'cache-and-network'`, `pollInterval: 30_000` (see site/src/hooks/useWeeklyCompletions.ts:22 and useUserChores.ts:32).
- [x] execute   [ ] skip

### T38. Selection sets copy-pasted instead of using gql fragments: `queries.ts` (site/src/graphql/queries.ts:45)
- Lenses: duplication
- Risk: low
- Proposed fix: Selection sets are copy-pasted throughout queries.ts: completion core fields at :48-59 vs :90-95; nested `user { id uuid name }` at :69-73 vs :101-105 vs :145-149; note field list at :74-81 vs :106-113 vs :189-195; user summary at :6-12 vs :18-24 vs :203-208; and CREATE_CHORE (:214-224) / UPDATE_CHORE (:230-240) have byte-identical selection sets. Declare gql fragments at the top of queries.ts (UserSummary, ChoreSummary, NoteFields, CompletionFields) and interpolate them into GET_ALL_USERS, GET_USER, GET_USER_CHORES, GET_WEEKLY_CHORES, GET_ALL_WEEKLY_COMPLETIONS, GET_ALL_CHORES, CREATE_USER, CREATE_CHORE, UPDATE_CHORE, ADD_CHORE_NOTE. Keep the deliberately narrower selections (GET_ALL_WEEKLY_COMPLETIONS asks for only `chore { id uuid name }`) as explicit inline sets rather than forcing them onto the wide fragment, so payload sizes do not grow. (Note GET_USER itself is flagged unused by T80 — delete it there rather than fragment-ising it.)
- [x] execute   [ ] skip

### T39. Identical error-toast effect written verbatim in three hooks: `useEffect(() => { if (error) toast.error(...) }, [error])` (site/src/hooks/useBalances.ts:16-18)
- Lenses: duplication
- Risk: low
- Proposed fix: The same effect appears verbatim in useBalances.ts:16-18, useBonusChores.ts:34-36 and useUserBadges.ts:17-19. Add site/src/hooks/useErrorToast.ts exporting `useErrorToast(error, message)` wrapping the useEffect. Replace the three blocks and drop the now-unused `useEffect` and `toast` imports from each file. This pairs naturally with site/src/utils/withErrorToast.ts, which already covers the imperative half of the same concern.
- [x] execute   [ ] skip

### T40. Byte-identical auth guard across three admin page files: `isCheckingAuth` spinner + Access Denied panel (site/src/page/AdminChoreManagementPage.tsx:6-33)
- Lenses: duplication
- Risk: low
- Proposed fix: The `isCheckingAuth` spinner + Access Denied panel is byte-identical across three files: AdminChoreManagementPage.tsx:6-33, AdminCompletionReviewPage.tsx:6-33, AdminPayoutSystemPage.tsx:6-33 (same OutletContext interface, same markup, same Tailwind strings). Add site/src/page/RequireAdmin.tsx exporting the shared OutletContext interface and a RequireAdmin component taking a children render-prop, with the Access Denied markup extracted into a local AccessDenied component. Each of the three page files collapses to a one-liner. While there, the login button class string at :27 of all three matches site/src/components/AdminHomePanel.tsx:14 — route both through the existing Button component.
- [x] execute   [ ] skip

### T41. Three copy-pasted nav buttons plus inline auth bootstrapping: `PageTemplate` (site/src/page/PageTemplate.tsx:27, 105 lines)
- Lenses: long-methods
- Risk: medium
- Proposed fix: Add `const ADMIN_NAV_ITEMS = [{ path: '/admin/chores', label: 'Chore Management' }, { path: '/admin/reviews', label: 'Review Completions' }, { path: '/admin/payouts', label: 'Payout System' }]` and map it into an `<AdminNav items pathname onNavigate />` (replaces lines 70-101 verbatim); extract `useAdminSession(): { currentAdmin, isCheckingAuth }` from lines 28-38 plus the module-level `checkAdminSession`; extract `<AppHeader currentAdmin isCheckingAuth onLogin onLogout />` so PageTemplate is just header + Outlet + Footer. Note site/src/components/NavItem.tsx already exists and appears unused — reuse it here or take the deletion in T36 (do not do both).
- [x] execute   [ ] skip

### T42. Two independent `formatCurrency` implementations with different units and zero handling: `formatCurrency` (site/src/utils/dateUtils.ts:49-54 and site/src/components/UserBalance.tsx:8-17)
- Lenses: duplication
- Risk: medium
- Proposed fix: dateUtils.ts:49-54 `formatCurrency(amountCents)` divides by 100 and uses toLocaleString; UserBalance.tsx:8-17 `formatCurrency(amount, currency, locale)` takes dollars, uses Intl.NumberFormat and returns '-' for zero — same intent, different units and zero handling, one shadowing the other's name. Move currency formatting into site/src/utils/currency.ts with two explicitly-named entry points sharing one Intl.NumberFormat instance: `formatCents(amountCents)` and `formatDollars(amount, opts?: { zeroAs?: string })`. Re-export `formatCents` from dateUtils.ts or update its importers (ChoreCard.tsx:3, ChoreRow.tsx:4, CompletionCard.tsx:3, ChoreCompletionDetail.tsx:5, AdminPayoutSystem.tsx:6, AdminCompletionReview.tsx:14, BonusChoreSection.tsx:4) and replace UserBalance.tsx:8-17 with `formatDollars(userBalance.balance, { zeroAs: '-' })`. **DO NOT collapse the two into one function — the cents/dollars unit difference is load-bearing and a wrong merge silently multiplies displayed balances by 100.** Give each new function a TSDoc naming its unit explicitly (cents is the wire format for every money field; dollars is the YNAB-sourced balance).
- [x] execute   [ ] skip

### T43. Handler nests four control levels behind a file-level clippy allow, and its label hides the admin/MIME/size/replace rules: `upload_user_image` (src/api/images.rs:54-113)
- Lenses: long-methods, comments
- Risk: high — needs characterization tests first
- Proposed fix: Flatten the loop with guard clauses: `let Some(name) = field.name() else { continue };` and `if name != "image" { continue; }`. Then extract two helpers: `async fn read_image_field(multipart: &mut Multipart) -> Result<(Vec<u8>, String), AppError>` (owning the content-type and MAX_IMAGE_SIZE validation) and `fn replace_user_image(context: &GraphQLContext, user_id: i32, data: Vec<u8>, content_type: String) -> Result<(), AppError>` (delete-existing, create, update reference). The handler collapses to auth -> fetch user -> read field -> replace -> 200, and the blanket `#![allow(clippy::collapsible_if)]` at line 1 of the file can be removed. Replace the `// Image upload handler` label at :54 with a `///` doc adding what it omits: admin cookie required, only a multipart field named 'image' is accepted, content type must start with 'image/', size is capped at MAX_IMAGE_SIZE, and any existing image for the user is replaced.
- [ ] execute   [ ] skip

### T44. Router function never mounted — routes.rs nests only /graphql, /auth, /images: `api_routes` (src/api/mod.rs:14-16)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete `pub fn api_routes` (src/api/mod.rs:14-16) and the `test` handler it is the sole caller of (T45). Verified: `git grep api_routes` across the whole repo (src/, tests/, site/, migrations/, .github/, Dockerfile, justfile) returns only the definition; `src/routes.rs::app()` never calls it.
- [x] execute   [ ] skip

### T45. Handler only reachable through the never-mounted router: `test` (src/api/mod.rs:18-20)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete `pub async fn test` (src/api/mod.rs:18-20). Verified: its only reference is inside `api_routes` (T44); no route table, config file or frontend fetch targets /api/test. Do together with T44.
- [x] execute   [ ] skip

### T46. Generic helper with zero callers anywhere in the workspace: `err_wrapper<T>` (src/api/mod.rs:22-27)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete `pub fn err_wrapper` (src/api/mod.rs:22-27). Verified: `git grep err_wrapper` over the whole repo returns only the definition. Note the `use serde::Serialize;` and `use axum::Json;` imports at the top of the file become unused once it goes and must be dropped too.
- [x] execute   [ ] skip

### T47. HTTP status chosen by string-matching the error message, which breaks the moment anyhow context is prepended: `AppError::into_response` (src/api/mod.rs:37)
- Lenses: idioms
- Risk: medium
- Proposed fix: Introduce a `pub struct Unauthorized;` marker error implementing Display + std::error::Error, then in IntoResponse use `self.0.downcast_ref::<Unauthorized>().is_some()` to choose `StatusCode::UNAUTHORIZED`, and construct with `AppError(anyhow!(Unauthorized))` in src/api/images.rs.
- [x] execute   [ ] skip

### T48. 50-line async initializer covering discovery fetch, error-chain logging, status check, JSON parse and a second JWKS fetch, with no doc: `OidcConfig::initialize` (src/auth.rs:71-120, 50 lines)
- Lenses: long-methods, comments
- Risk: high — needs characterization tests first
- Proposed fix: Extract `async fn fetch_discovery_config(client: &reqwest::Client, url: &str) -> Result<OidcDiscoveryConfig>` (lines 74-105, including the error-chain logging) and `async fn fetch_jwks(client: &reqwest::Client, jwks_uri: &str) -> Result<jsonwebtoken::jwk::JwkSet>` (lines 107-115). `initialize` then reads: build client, `let config = fetch_discovery_config(..).await?;`, `let jwks = fetch_jwks(&client, &config.jwks_uri).await?;`, assign, Ok(()). Add a doc comment stating that it fetches the OIDC discovery document and then the JWKS from the discovered jwks_uri, that it must be called once at startup before any other method, and that the keys are cached for the process lifetime with no refresh on key rotation.
- [ ] execute   [ ] skip

### T49. Cookie security-attribute chain written twice with different lifetimes: `oidc_state` / `admin_session` cookie builders (src/auth.rs:285-291 and :419-425)
- Lenses: duplication
- Risk: high — needs characterization tests first
- Proposed fix: The chain `.path("/").http_only(true).secure(!cfg!(debug_assertions)).same_site(SameSite::Lax)` is written twice with different lifetimes: src/auth.rs:285-291 (oidc_state, 10 min) and :419-425 (admin_session, 7 days), so a hardening change to one can silently miss the other. Add `fn secure_cookie(name: &'static str, value: String, max_age: time::Duration) -> Cookie<'static>` in src/auth.rs building the shared path/http_only/secure/same_site attributes plus max_age. Call it at :285 and :419. (Do after T10, which introduces the `ADMIN_SESSION_COOKIE` constant the :419 site should use.)
- [ ] execute   [ ] skip

### T50. Six Query resolvers exposed in the schema but never issued by the frontend: `getAdmin`, `listAdmins`, `getChore`, `getChoreCompletion`, `listChoreCompletions`, `listChoreCompletionNotes` (src/graphql.rs:46)
- Lenses: dead-code
- Risk: medium
- Proposed fix: **[decision needed — rename/public-API, not auto-applied]** Delete `get_admin` (src/graphql.rs:46), `list_admins` (:50), `get_chore` (:61), `get_chore_completion` (:83), `list_chore_completions` (:90) and `list_chore_completion_notes` (:132) from `impl Query`. Verified: extracted every field name from `impl Query` and grepped each across site/src (incl. gql template literals) and tests/ — these six have zero hits. Medium risk because this shrinks public GraphQL API surface; the underlying service fns stay live via other paths, so do not cascade the deletion into src/svc/.
- [ ] execute   [ ] skip

### T51. Seven Mutation resolvers exposed but never invoked by the frontend: `updateUser`, `deleteUser`, `createAdmin`, `updateAdmin`, `deleteChore`, `updateChoreCompletionNote`, `deleteChoreCompletionNote` (src/graphql.rs:171)
- Lenses: dead-code
- Risk: medium
- Proposed fix: **[decision needed — rename/public-API, not auto-applied]** Delete `update_user` (:171), `delete_user` (:176), `create_admin` (:183), `update_admin` (:188), `delete_chore` (:212), `update_chore_completion_note` (:289) and `delete_chore_completion_note` (:297) from `impl Mutation`. Verified: each field name grepped across site/src and tests/ with zero hits. Medium risk: this is public API surface and removal also orphans `UserSvc::update/delete`, `AdminSvc::create/update` and `ChoreCompletionNoteSvc::update/delete` (all of which still have in-file test callers, so leave the svc layer alone). Interacts with T90: several of these are among the six resolver bodies T90 wants to collapse into a helper — if this deletion is taken, delete those sites and extract only from the survivors.
- [ ] execute   [ ] skip

### T52. Admin-only mutation exposed to kids by an always-visible UI button: `createChoreCompletionNote` (src/graphql.rs:281)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: `createChoreCompletionNote` requires admin, but the kid-facing completion detail modal exposes an Add Note button that always errors for unauthenticated users. Cheapest fix: gate the Add Note UI on `isAdmin` in site/src/components/ChoreCompletionDetail.tsx (the '+ Add Note' button and its form). If kid notes are actually wanted, instead relax the resolver to allow `AuthorType::User` notes without a session while forcing `author_admin_id = None` and `visible_to_user = true` server-side.
- User Note: we can make that admin-only
- [x] execute   [ ] skip

### T53. Env lookups scan the entire process environment instead of using `env::var`: `get_env` / `get_env_typed` (src/lib.rs:33)
- Lenses: idioms
- Risk: low
- Proposed fix: `pub fn get_env(search_key: &str, default: &str) -> String { env::var(search_key).unwrap_or_else(|_| default.to_owned()) }` and `get_env_typed` using `env::var(search_key).ok().and_then(|v| v.parse::<T>().ok()).unwrap_or(default)`.
- [ ] execute   [ ] skip

### T54. `.expect()` panic for the migration connection in a function that otherwise uses `?`: `main` (src/main.rs:35)
- Lenses: idioms
- Risk: low
- Proposed fix: `let mut conn = context.pool.clone().get().context("Could not get connection for migrations")?;`
- [ ] execute   [ ] skip

### T55. N+1: one user_images query per user, fanning out to chores x users on nested selections: `User::image_path` (src/models.rs:94)
- Lenses: opportunistic
- Risk: high — needs characterization tests first
- Proposed fix: Batch this: resolve image paths for the whole result set in one `user_images.filter(user_id.eq_any(ids))` query cached on `GraphQLContext`, or serve `/images/user/{id}` (the route already exists in src/api/images.rs:35) directly from the `image_id` column already loaded on User, eliminating the query entirely.
- [x] execute   [ ] skip

### T56. Two queries per chore where the service layer already does it in one join: `Chore::assigned_users` (src/models.rs:311)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: Replace the body with a delegation to `ChoreSvc::get_assigned_users(context, self.id.ok_or(...)?)` (src/svc/chore.rs:152), which performs the `chore_assignments INNER JOIN users` in a single query; drop the now-unused assignments/user_ids locals and the `debug!` on them.
- [x] execute   [ ] skip

### T57. Request body limit is a raw literal while the related per-image cap is a named constant: `6 * 1024 * 1024` (src/routes.rs:89)
- Lenses: idioms
- Risk: low
- Proposed fix: In src/api/images.rs add `pub const MAX_UPLOAD_BODY_SIZE: usize = MAX_IMAGE_SIZE + 1024 * 1024;` with a doc comment explaining the multipart envelope overhead, and use it in src/routes.rs `RequestBodyLimitLayer::new(MAX_UPLOAD_BODY_SIZE)` so the 1 MiB slack is documented and the two cannot drift.
- [x] execute   [ ] skip

### T58. Nested match-on-Result-with-continue blocks plus a fresh pool connection per badge check: `BadgeSvc::check_and_award` (src/svc/badge.rs:14)
- Lenses: long-methods, opportunistic
- Risk: medium
- Proposed fix: `check_and_award` nests two match-on-Result-with-continue blocks plus an `if` inside the badge loop, obscuring the one-line intent, and takes a fresh pool connection for every badge check and every award, so one approval costs 6+ checkouts. Extract `fn try_award_if_earned(context: &GraphQLContext, user_id: i32, badge_type: &BadgeType) -> Result<()>` containing `if Self::is_earned(context, user_id, badge_type)? { Self::award(&mut get_conn(context)?, user_id, badge_type)?; } Ok(())`. The public loop becomes three lines: `for badge_type in BadgeType::all() { if let Err(e) = Self::try_award_if_earned(context, user_id, &badge_type) { tracing::warn!("Badge check/award failed for {:?}: {:?}", badge_type, e); } }` — preserving the non-fatal contract documented on the function. While restructuring, acquire one `get_conn(context)?` at the top of `check_and_award` and pass `&mut conn` down to `is_earned` / `check_first_chore` / `check_earnings` / `check_perfect_week` / `check_five_day_streak` / `award` (all private, so no public-API change); `check_perfect_week` currently takes two connections by itself.
- [ ] execute   [ ] skip

### T59. 47-line function doing two queries, an ISO-week grouping build and a subset scan, with imports declared mid-body: `BadgeSvc::check_perfect_week` (src/svc/badge.rs:86-132, 47 lines)
- Lenses: long-methods
- Risk: low
- Proposed fix: Move the mid-function `use chrono::Datelike;` / `use std::collections::{HashMap, HashSet};` (lines 112-114) to the top of the file, then extract `fn completions_by_iso_week(records: &[(i32, NaiveDate)]) -> HashMap<(i32, u32), HashSet<i32>>` (lines 115-123) — a pure function that is directly unit-testable without a database. `check_perfect_week` reduces to: load assignments (early-return if empty), load completions (early-return if empty), group, `week_completions.values().any(|w| assigned_set.is_subset(w))`.
- [ ] execute   [ ] skip

### T60. PerfectWeek groups by Monday-based ISO weeks while the UI and every weekly query use Sunday-based weeks: `check_perfect_week` (src/svc/badge.rs:118)
- Lenses: opportunistic
- Risk: high — needs characterization tests first
- Proposed fix: _(flag-only — no auto-fix proposed; escalate to /code-health for a deeper look)_
- [ ] execute   [ ] skip

### T61. 48-line `map_or_else` whose two closures repeat the same filter/select/order/limit/offset chain, undocumented: `ChoreSvc::list` (src/svc/chore.rs:30-77, 48 lines)
- Lenses: long-methods, comments
- Risk: low
- Proposed fix: Extract two private helpers `fn list_all(context: &GraphQLContext, active_only: bool, limit: i64, offset: i64) -> Result<Vec<Chore>>` and `fn list_for_user(context: &GraphQLContext, user_id: i32, active_only: bool, limit: i64, offset: i64) -> Result<Vec<Chore>>`, leaving `list` as a 6-line dispatch (`match user_id { None => Self::list_all(..), Some(uid) => Self::list_for_user(..) }`), which also reads better than the `map_or_else` with two multi-statement closures. Add a doc comment stating that passing `user_id` joins through chore_assignments to return only that user's chores while `None` returns every chore, and what `active_only` filters.
- [ ] execute   [ ] skip

### T62. 51 lines of paging setup plus seven sequential filter mutations, with paging defaults and ordering undocumented: `ChoreCompletionSvc::list` (src/svc/chore_completion.rs:40-90, 51 lines)
- Lenses: long-methods, comments
- Risk: low
- Proposed fix: Extract `fn apply_completion_filters<'a>(query: chore_completions::BoxedQuery<'a, Sqlite>, filter: &ChoreCompletionFilter) -> chore_completions::BoxedQuery<'a, Sqlite>` holding lines 52-80, leaving `list` as paging -> apply filters -> select/order/limit/offset/load. If the boxed-query type proves awkward to name, keep it inline but add the two section comments already present plus a `// Paging` header over lines 44-49. Add a doc comment recording the default limit of 100, the hard `MAX_COMPLETION_LIMIT` clamp, and that results come back ordered by `completed_date` descending.
- [ ] execute   [ ] skip

### T63. Duplicated approved+unpaid -> paid_out UPDATE, and `None` silently pays out every user: `mark_as_paid` / `mark_as_paid_batch` (src/svc/chore_completion.rs:229-249 and :252-265)
- Lenses: duplication, comments
- Risk: high — needs characterization tests first
- Proposed fix: Both duplicate the same approved+unpaid -> paid_out UPDATE against a money column; only the batch version is reachable from production (src/graphql.rs:266), the single version survives solely for tests. Keep one private `fn set_paid_out(context: &GraphQLContext, user_ids: Option<&[i32]>) -> Result<()>` applying `.filter(approved.eq(true)).filter(paid_out.eq(false))`, conditionally adding `.filter(user_id.eq_any(ids))` when `Some`, setting paid_out/paid_out_at once. Rewrite `mark_as_paid` as `set_paid_out(context, user_id.as_ref().map(std::slice::from_ref))` and `mark_as_paid_batch` as `set_paid_out(context, Some(user_ids))`, preserving public signatures so existing tests are untouched. **Preserve the semantic asymmetry: `mark_as_paid(None)` means ALL users, `mark_as_paid_batch(&[])` means NONE.** Add a doc comment on `mark_as_paid` warning that `None` marks every approved, unpaid completion across all users as paid — a family-wide payout — while `Some(id)` scopes it to one user.
- [ ] execute   [ ] skip

### T64. Bare `bool` parameter makes call sites unreadable: `list_for_completion(context, id, false)` (src/svc/chore_completion_note.rs:22)
- Lenses: idioms
- Risk: medium
- Proposed fix: **[decision needed — rename/public-API, not auto-applied]** Introduce `pub enum NoteAudience { UserVisible, All }` and change the third parameter to `audience: NoteAudience`; update src/models.rs:496 -> `NoteAudience::UserVisible` and src/models.rs:510 -> `NoteAudience::All`. The same bare-bool pattern applies to `ChoreSvc::list`'s `active_only` at src/svc/chore.rs:33.
- [ ] execute   [ ] skip

### T65. get-by-uuid / create-then-reread / update / delete quartet written five times: service-layer CRUD (src/svc/user.rs:25, src/svc/chore.rs:14, src/svc/admin.rs:11, src/svc/chore_completion_note.rs:11, src/svc/chore_completion.rs:30)
- Lenses: duplication
- Risk: medium
- Proposed fix: **[decision needed — rename/public-API, not auto-applied]** The quartet is written five times with only the table, model and `.context("...")` string varying: src/svc/user.rs:25,54,62,72; src/svc/chore.rs:14,79,88,98; src/svc/admin.rs:11,40,49,89; src/svc/chore_completion_note.rs:11,39,51,64; src/svc/chore_completion.rs:30,267. Add a `pub trait UuidCrud` in a new src/svc/crud.rs with associated Table/Model types, an ENTITY name const, and provided get/create/update/delete methods built on Diesel's Table/Selectable/AsChangeset bounds, deriving the anyhow context as `format!("Could not find {}", Self::ENTITY)`. Implement for UserSvc, ChoreSvc, AdminSvc, ChoreCompletionNoteSvc, ChoreCompletionSvc. This changes call sites at src/graphql.rs:28,47,62,87,168,173,178,185,190,196,204,209,214,245,286,294,302 (a `use` import of the trait, same call syntax) and is a public-API change, so it must not be auto-applied. If the Diesel generic bounds prove too hairy, the smaller win is to factor only the `Self::get(context, &m.uuid)` re-read tails.
- [ ] execute   [ ] skip

## Low severity

### T66. Entire test-site CI job commented out since 2025-10-26: `# test-site:` (.github/workflows/rust.yml:73-107)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete the commented `# test-site:` job block in .github/workflows/rust.yml (lines 73-107). Verified with `git blame -L 73,80` -> commit 9532e10e, 2025-10-26 (>30 days). Frontend tests are instead run by the local pre-commit hook (.husky/pre-commit), so nothing depends on this block. If frontend CI coverage is actually wanted, re-add it as live YAML rather than leaving it commented.
- [ ] execute   [ ] skip

### T67. Commented-out Lambda deploy block ~9 months stale: `[package.metadata.lambda.deploy]` (Cargo.toml:77-86)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete Cargo.toml lines 77-86. Verified with `git blame -L 77,86 Cargo.toml` -> commit 2ca7f39e, 2025-10-29 (>30 days). Nothing in .github/workflows/rust.yml or Dockerfile deploys to Lambda; deployment is a Docker image build.
- [ ] execute   [ ] skip

### T68. Superseded viteFinal plugin-push code left commented out since 2025-10-25: `config.plugins` / `mergeConfig` block (site/.storybook/main.ts:25-28)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete site/.storybook/main.ts lines 25-28 (the commented `config.plugins` / `mergeConfig` block) and the dead `// import type { StorybookConfig } ...` on line 1. Verified with `git blame -L 24,29` -> commit 1d8589b4, 2025-10-25 (>30 days); line 24 already returns the working `mergeConfig(config, { plugins: [tailwindcss()] })`.
- [ ] execute   [ ] skip

### T69. Redundant commented-out ignores array plus two dead rule lines: eslint ts/tsx config block (site/eslint.config.js:27-32, :61-62)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete site/eslint.config.js lines 27-32 (the `// ignores: [ ... ]` block) and the two dead `// 'react/jsx-uses-*'` lines at :61-62. Verified with `git blame -L 26,32` -> commit 33aaf438, 2026-04-14 (>30 days before 2026-08-04). A live top-level ignores array already exists at lines 11-19, so the commented one is redundant.
- [ ] execute   [ ] skip

### T70. Jest types installed although the test runner is Vitest: `@types/jest` (site/package.json:46)
- Lenses: dead-code
- Risk: high — needs characterization tests first
- Proposed fix: Remove `"@types/jest": "^30.0.0"` from devDependencies. Verified: `grep -rn '\bjest\.|@jest/globals'` over site/src and site/setupVitest.ts returns nothing; site/vite.config.ts configures `test.globals`, and site/tsconfig.json sets `"types": []` so the ambient jest types are not even pulled into the program. @testing-library/jest-dom (a different package) stays — it is used by setupVitest.ts.
- [ ] execute   [ ] skip

### T71. Installed with no PostCSS pipeline — Tailwind v4 runs through @tailwindcss/vite: `autoprefixer` (site/package.json:54)
- Lenses: dead-code
- Risk: high — needs characterization tests first
- Proposed fix: Remove `"autoprefixer": "^10.4.19"` from devDependencies. Verified: no postcss.config* outside node_modules, site/vite.config.ts declares no `css.postcss` option, and site/src/index.css uses `@import "tailwindcss"` (v4, which handles vendor prefixing internally).
- [ ] execute   [ ] skip

### T72. devDependency of site/ but only the root package.json installs hooks: `husky` (site/package.json:70)
- Lenses: dead-code
- Risk: medium
- Proposed fix: Remove `"husky": "^9.1.7"` from site/package.json devDependencies and delete the orphaned site/.husky/pre-commit. Verified: site/package.json has no `prepare` script, so husky is never invoked there; the root package.json owns `"prepare": "husky"` plus its own husky devDependency, and the active hook is the repo-root .husky/pre-commit (which already does `cd site && npx lint-staged && CI=true yarn test`). site/.husky/pre-commit contains a lone `npm test` that git never runs.
- [ ] execute   [ ] skip

### T73. Prev/This Week/Next button trio duplicates the desktop branch of an existing component: `WeekNavigator` (site/src/components/AdminCompletionReview.tsx:93-112)
- Lenses: duplication
- Risk: low
- Proposed fix: Replace :93-112 with `<WeekNavigator currentWeekStart={currentWeekStart} onWeekChange={setCurrentWeekStart} weekRange={weekRange} />` and add the import (site/src/components/WeekNavigator.tsx:51-68 has the identical Tailwind class strings). The `getPreviousWeek`/`getNextWeek` imports at :10-17 can then be trimmed.
- [ ] execute   [ ] skip

### T74. id-toggle reducer written identically in three places: `setX((prev) => prev.includes(id) ? prev.filter(...) : [...prev, id])` (site/src/components/AdminPayoutSystem.tsx:32-36, CreateChoreForm.tsx:96-100 and :176-180)
- Lenses: duplication
- Risk: low
- Proposed fix: Add `export function toggleInArray<T>(list: T[], item: T): T[]` to a new site/src/utils/array.ts and rewrite the three sites as `setX((prev) => toggleInArray(prev, item))`.
- [ ] execute   [ ] skip

### T75. Claim-then-confetti handler duplicated, and badge chip markup duplicated: `celebrateOnSuccess` (site/src/components/ChoreRow.tsx:94-101 and BonusChoreSection.tsx:48-56)
- Lenses: duplication
- Risk: low
- Proposed fix: The claim-then-confetti handler is duplicated at ChoreRow.tsx:94-101 and BonusChoreSection.tsx:48-56 — same `confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })` literal and the same swallow-the-error comment; separately the badge chip markup is duplicated at WeeklyChoreView.tsx:162-177 and :181-196. Add `export async function celebrateOnSuccess(action: () => Promise<void>): Promise<void>` to a new site/src/utils/celebrate.ts and call it from ChoreRow.tsx:94 and BonusChoreSection.tsx:48. For the badge chips, extract a BadgeChips component and use it at both WeeklyChoreView.tsx:162 and :181, passing the only differing class (`overflow-x-auto pb-1 mt-2` vs `flex-wrap mb-4`).
- [ ] execute   [ ] skip

### T76. Whole body wrapped in `if (title.trim())` with an inlined six-line form reset: `handleSubmit` (site/src/components/CreateChoreForm.tsx:66)
- Lenses: long-methods
- Risk: high — needs characterization tests first
- Proposed fix: Invert to `if (!title.trim()) return;` after `e.preventDefault()`, and extract `const resetForm = () => { setTitle(''); setDescription(''); setValue(0); setPaymentType(PaymentType.Daily); setSelectedUserIds([]); setSelectedDays([]); }` so the tail is `if (!isEditMode) resetForm();`. (Do after T35, which rewrites the bitmask reduce in the same function.)
- [ ] execute   [ ] skip

### T77. Timing and breakpoint constants inconsistently named — most are raw literals: 600px breakpoint (site/src/components/WeeklyChoreView.tsx:55)
- Lenses: idioms
- Risk: low
- Proposed fix: HomePage.tsx names `USER_AUTO_DESELECT_MS`, but the 600px mobile breakpoint here, the 500ms debounce in AutoUpdateInput.tsx:21, and the poll intervals in useBalances.ts:13 / useUserChores.ts:38 / useWeeklyCompletions.ts:25 are raw literals. Add site/src/constants.ts with `MOBILE_BREAKPOINT_PX = 600`, `INPUT_DEBOUNCE_MS = 500`, `CHORE_POLL_INTERVAL_MS = 30_000`, `BALANCE_POLL_INTERVAL_MS = 5 * 60 * 1000` and reference them at each site.
- [ ] execute   [ ] skip

### T78. Predicate recomputes a date format inside `.some()` and linearly scans every completion per render: `isChoreCompletedByUser` (site/src/components/WeeklyChoreView.tsx:114)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: Hoist the date once (`const key = formatDateForGraphQL(date);`) and, better, extend the existing `completionLookup` useMemo (line 100) to also add `${c.choreId}-${c.userId}-${c.completedDate}` keys so this becomes a Set lookup like `isChoreCompletedByAnyone`.
- [ ] execute   [ ] skip

### T79. Inline array literal prop allocates a fresh array per render for every row: `dates={[currentDate]}` (site/src/components/WeeklyChoreView.tsx:223)
- Lenses: idioms
- Risk: low
- Proposed fix: `const singleDayDates = useMemo(() => [currentDate], [currentDate]);` then `<ChoreRow dates={singleDayDates} ... />`.
- [ ] execute   [ ] skip

### T80. gql document exported but never imported by any component, hook, story or test: `GET_USER` (site/src/graphql/queries.ts:16-27)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete `export const GET_USER = gql\`...\`` (site/src/graphql/queries.ts:16-27). Verified: `grep -rn '\bGET_USER\b'` (word-boundary, so GET_USER_CHORES/GET_USER_BADGES are excluded) across site/src returns only the definition. Every other export in this file has at least 3 references. Note the backend `getUser` resolver then also becomes unqueried — see T50.
- [ ] execute   [ ] skip

### T81. refetch() promises dropped on the floor, so a failing refetch surfaces as an unhandled rejection: `useRefetchingMutation` (site/src/hooks/useRefetchingMutation.ts:15)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: Wrap the calls: `refetch().catch(() => toast.error('Could not refresh data'))` here, and do the same for the floating refetches at site/src/components/WeeklyChoreView.tsx:89, :96, :97, site/src/components/AdminPayoutSystem.tsx:26, and site/src/components/AdminCompletionReview.tsx:41, :48.
- [ ] execute   [ ] skip

### T82. Interface with no references outside its own declaration: `ChoreFormInput` (site/src/types/chore.ts:102-109)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete `export interface ChoreFormInput` (site/src/types/chore.ts:102-109). Verified: `grep -rn '\bChoreFormInput\b'` across all of site/src returns only line 102. Forms use `ChoreInput` (10 references) instead.
- [ ] execute   [ ] skip

### T83. Unused TS interface whose only other match is a server-side type name inside a gql string: `ChoreCompletionInput` (site/src/types/chore.ts:111-115)
- Lenses: dead-code
- Risk: medium
- Proposed fix: Delete `export interface ChoreCompletionInput` (site/src/types/chore.ts:111-115). Verified: `grep -rn '\bChoreCompletionInput\b'` across site/src returns line 111 plus site/src/graphql/queries.ts:157, which is the GraphQL schema type name inside the CreateChoreCompletion mutation template literal — not a TypeScript reference. Removing the interface does not affect the mutation.
- [ ] execute   [ ] skip

### T84. Interface and the constant it types are unused across the whole frontend: `DayOfWeek` / `DAYS_OF_WEEK` (site/src/types/chore.ts:127-141)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete `export interface DayOfWeek` (site/src/types/chore.ts:127-131) and `export const DAYS_OF_WEEK: DayOfWeek[]` (:133-141). Verified: `grep -rn '\bDAYS_OF_WEEK\b'` across site/src returns only its own declaration, and DayOfWeek's only other reference is that same declaration. Weekday labels are generated at runtime in WeeklyChoreView/ChoreGridHeader from date arithmetic instead.
- [ ] execute   [ ] skip

### T85. Config file never loaded — Tailwind v4 ignores JS config without `@config`, and CJS is invalid in this ESM package: `site/tailwind.config.js` (site/tailwind.config.js:1)
- Lenses: dead-code
- Risk: medium
- Proposed fix: Delete site/tailwind.config.js. Verified: site/src/index.css starts with `@import "tailwindcss"` and contains no `@config` directive; `grep -rn '@config|tailwind.config'` over site/src/index.css, site/vite.config.ts and site/.storybook/main.ts returns nothing; both vite.config.ts and .storybook/main.ts wire Tailwind via the @tailwindcss/vite plugin only. The file also uses `module.exports` while site/package.json declares `"type": "module"`, so it could not load even if referenced.
- [ ] execute   [ ] skip

### T86. Commented-out paths mapping dead since the initial commit: tsconfig `paths` (site/tsconfig.json:5-9)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete site/tsconfig.json lines 5-9 (the commented paths block). Verified with `git blame -L 3,10` -> commit dec98da, 2025-05-20 (>30 days). Path resolution actually works via `"baseUrl": "src"` on line 4 plus the vite-tsconfig-paths plugin, which is why imports like `from 'components/Footer'` resolve today.
- [ ] execute   [ ] skip

### T87. Macro written fully qualified despite already being imported: `anyhow::anyhow!` (src/api/images.rs:22 and :28)
- Lenses: idioms
- Risk: low
- Proposed fix: `use anyhow::{Context, anyhow}` is already in scope at line 6, so use the already-imported macro: `.ok_or_else(|| AppError(anyhow!("Unauthorized")))?` at both sites (CLAUDE.md import rule).
- [ ] execute   [ ] skip

### T88. Two byte-identical four-header Response::builder bodies with stringly-typed headers and a Content-Length taken from a stored column: `get_user_image` / `get_image_by_uuid` (src/api/images.rs:115-129 and :132-146)
- Lenses: duplication, idioms, opportunistic
- Risk: medium
- Proposed fix: `get_user_image` (:115-129) and `get_image_by_uuid` (:132-146) differ only in which `UserImageSvc` lookup they call. Add `fn image_response(image: UserImage) -> Result<Response, AppError>` in src/api/images.rs containing the `Response::builder()` header chain; :119-128 becomes `image_response(UserImageSvc::get_full_by_user_id(...)?)` and :136-145 the same with `get_by_uuid`. Import `CACHE_CONTROL`, `CONTENT_LENGTH`, `CONTENT_TYPE` from `axum::http::header` instead of the string literals at :124-126 and :141-143 (also `"cache-control"` at src/routes.rs:108). While rewriting, fix the Content-Length: it is taken from the stored `file_size` column instead of the actual body length, so a stale column value produces a malformed response — compute `let len = image.image_data.len();` before moving the data into the body and set the header from that (applies to both :125 and :142). Replace the `// Get user image handler` (:114) and `// Get image by UUID handler` (:131) labels with `///` docs noting the endpoints are unauthenticated, stream the stored bytes with the stored content type and set the long-lived IMAGE_CACHE_CONTROL header, and that the uuid variant is the content-addressed cache-busting form.
- [ ] execute   [ ] skip

### T89. `std::fmt::*` written fully qualified inline against the project import rule: `impl Debug for OidcConfig` (src/auth.rs:36)
- Lenses: idioms
- Risk: low
- Proposed fix: src/lib.rs already models the project rule with `use std::{env, fmt, str::FromStr}`. Add `use std::fmt;` and write `impl fmt::Debug for OidcConfig { fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { ... } }`.
- [ ] execute   [ ] skip

### T90. Three-line `require_admin` / `graphql_translate_anyhow` / `Ok(true)` shape repeated for six unit-returning mutations: resolver preamble (src/graphql.rs:176-180, :212-216, :219-227, :230-238, :271-278, :297-304)
- Lenses: duplication
- Risk: low
- Proposed fix: Add a private helper next to `graphql_translate_anyhow`: `fn admin_unit(context: &GraphQLContext, f: impl FnOnce() -> anyhow::Result<()>) -> FieldResult<bool>`. Each of the six mutation bodies collapses to one line. Leave `approve_chore_completion` (:248) alone — it needs the returned admin_id — and leave the `DEFAULT_LIST_LIMIT`/`DEFAULT_LIST_OFFSET` unwrapping in the Query impl as-is. Note: if the flagged unused-resolver deletion (T51) is taken, delete those sites rather than collapsing them and extract only from the survivors.
- [ ] execute   [ ] skip

### T91. 49-line startup function with no internal structure: `main` (src/main.rs:18-66, 49 lines)
- Lenses: long-methods
- Risk: high — needs characterization tests first
- Proposed fix: Extract `fn init_tracing()` (lines 22-27), `fn init_context() -> Result<GraphQLContext>` (pool + `run_migrations` with its match-on-result logging, lines 29-39), and `async fn serve(app: Router) -> Result<()>` (listener bind + `axum::serve` + ctrl_c shutdown, lines 43-62). `main()` then reads as six labelled calls. If extraction is unwanted for a startup path, at minimum add `// --- logging ---`, `// --- database & migrations ---`, `// --- serve ---` section comments.
- [ ] execute   [ ] skip

### T92. Conversions allocate a lowercased String on every call, including once per Chore field resolution: `PaymentType::from` / `AuthorType::from` (src/models.rs:29 and :53)
- Lenses: opportunistic
- Risk: low
- Proposed fix: Swap `value.as_ref().to_lowercase().as_str()` matching for a borrow-only comparison: `if value.as_ref().eq_ignore_ascii_case("weekly") { Self::Weekly } else { Self::Daily }` (and the analogous "admin" check at src/models.rs:53). Existing tests `test_payment_type_from_string` / `test_author_type_from_string` cover the casing behaviour.
- [ ] execute   [ ] skip

### T93. Helper called fully qualified at all five call sites: `crate::uuid_or_generate` (src/models.rs:188, :226, :349, :635 and src/svc/chore_completion.rs:187)
- Lenses: idioms
- Risk: low
- Proposed fix: Extend the existing `use crate::{...}` block in src/models.rs to include `uuid_or_generate`, add `use crate::uuid_or_generate;` to src/svc/chore_completion.rs, and call it unqualified.
- [ ] execute   [ ] skip

### T94. juniper items written fully qualified inline despite being imported, with one closure repeated three times: `juniper::FieldError` / `Value` / `FieldResult` (src/models.rs:311, :318, :469, :476, :481, :495, :499, :509, :513)
- Lenses: idioms
- Risk: low
- Proposed fix: Extend the juniper import at line 9 to include `FieldError`, `FieldResult`, `Value` and drop the inline paths. The identical `FieldError::new("ChoreCompletion has no id", Value::null())` closure appears three times and should collapse into one `fn require_id(&self) -> FieldResult<i32>` helper.
- [ ] execute   [ ] skip

### T95. Input struct and its From impl are never constructed: `ChoreAssignmentInput` (src/models.rs:377-394)
- Lenses: dead-code
- Risk: medium
- Proposed fix: Delete `pub struct ChoreAssignmentInput` (src/models.rs:377-380) and the `impl From<ChoreAssignmentInput> for ChoreAssignment` block (:382-394). Verified: `git grep -w ChoreAssignmentInput` over the whole repo returns only those two blocks — it is not a Juniper input object referenced by any resolver in src/graphql.rs, and the GraphQL assign mutations take plain i32 args. `ChoreAssignment` itself stays (used by ChoreSvc).
- [ ] execute   [ ] skip

### T96. Inherent constructor never called: `BadgeType::from_str` (src/models.rs:669-679)
- Lenses: dead-code
- Risk: low
- Proposed fix: Delete the inherent `pub fn from_str(s: &str) -> Option<Self>` on BadgeType (src/models.rs:669-679). Verified: `git grep from_str` over src/ and tests/ hits only this definition plus an unrelated `serde_json::from_str` in tests/upgrade_jsonwebtoken.rs. `BadgeType::as_str` and `BadgeType::all` are both live (src/svc/badge.rs), so keep those.
- [ ] execute   [ ] skip

### T97. `replace("dist/", "")` strips every occurrence in the path, not just the leading one: `static_handler` (src/routes.rs:49)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: Replace the `starts_with` + `replace` pair with `if let Some(rest) = path.strip_prefix("dist/") { path = rest.to_owned(); }`.
- [ ] execute   [ ] skip

### T98. 43-line async builder mixing OIDC network initialization with CORS, compression and four sub-router assemblies: `routes::app` (src/routes.rs:61-103, 43 lines)
- Lenses: long-methods
- Risk: high — needs characterization tests first
- Proposed fix: Extract `async fn init_oidc() -> OidcConfig` (lines 63-69, keeping the warn-on-failure behaviour) and `fn base_middleware() -> ServiceBuilder<...>` (lines 71-78), leaving `app` as: schema, oidc, per-nest router construction, final `Router::new()` chain. The three `.layer(Extension(context.clone()))` sites stay put.
- [ ] execute   [ ] skip

### T99. Badge `earned_at` uses `Local::now()` while every other timestamp column uses UTC: `BadgeSvc::award` (src/svc/badge.rs:50)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: Change to `let now = chrono::Utc::now().naive_utc();` to match approved_at/paid_out_at/created_at handling in src/svc/chore_completion.rs and src/models.rs.
- [ ] execute   [ ] skip

### T100. `diesel::dsl::sum` written fully qualified inline: (src/svc/badge.rs:80 and src/svc/chore_completion.rs:147)
- Lenses: idioms
- Risk: low
- Proposed fix: Add `use diesel::dsl;` and call `.select(dsl::sum(chore_completions::amount_cents))` at both sites.
- [ ] execute   [ ] skip

### T101. Public wrapper whose only callers are the in-file test module: `BadgeSvc::check_five_day_streak_pub` (src/svc/badge.rs:169)
- Lenses: dead-code
- Risk: medium
- Proposed fix: _(flag-only — no auto-fix proposed; escalate to /code-health for a deeper look)_
- [ ] execute   [ ] skip

### T102. Check-then-insert across two pooled connections can duplicate an assignment: `ChoreSvc::assign_user` (src/svc/chore.rs:107)
- Lenses: opportunistic
- Risk: low
- Proposed fix: Drop the existence probe and use `diesel::insert_or_ignore_into(chore_assignments::table).values(&assignment)` on a single connection; the `UNIQUE(chore_id, user_id)` index makes it idempotent, and `test_chore_user_assignments` already asserts that idempotency.
- [ ] execute   [ ] skip

### T103. Needless clone of a field whose owner is never used again: `completion_input.uuid` (src/svc/chore_completion.rs:187)
- Lenses: idioms
- Risk: low
- Proposed fix: **[decision needed — not auto-applied]** Stale finding. `new_completion(input: &ChoreCompletionInput, ...)` takes its input by reference (the struct literal was extracted from `create` by T16), so `input.uuid.clone()` cannot simply be dropped — `cargo build` reports `error[E0507]: cannot move out of ... behind a shared reference`. The fix is mechanical and complete, not just accept-the-clone: changing `ChoreCompletionSvc::create` and `new_completion` to take the input by value gives a clean `cargo check --lib` with zero clones, because the sole production caller (`create_chore_completion` in `src/graphql.rs`) already owns its `ChoreCompletionInput` and merely passes `&completion` — taking it by value there costs nothing. Every other caller is `#[cfg(test)]`. It's deferred here not because the clone is irreducible, but because a by-value signature change through `create` and its call sites is a disabled category for this batch.
- [ ] execute   [ ] skip

### T109. Websocket endpoint serves the whole Query/Mutation root, unauthenticated and untested: `custom_subscriptions` (src/api/graphql.rs)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: `juniper_graphql_ws` 0.5 executes queries and mutations over the socket BEFORE considering the subscription root (`graphql_transport_ws/mod.rs:258-283`, `graphql_ws/mod.rs:233-258` — it falls through to subscriptions only on `Err(GraphQLError::IsSubscription)`). So `/graphql/subscriptions` is a live GraphQL transport for the entire schema with `admin_id: None`, and nothing tests it. This is NOT an escalation — `custom_graphql` also yields `admin_id: None` for a cookie-less request, so the posture equals anonymous HTTP — but it is a real, untested surface. T108's `subscription_root_is_still_empty` guard does NOT cover it; that guard fires on exactly one trigger, a change to `pub type Schema`'s third parameter. Discovered 2026-08-05 by a final whole-batch review reading the dependency's source; the batch's own comments had asserted the opposite. Either add a websocket test harness exercising a query over the socket, or restrict the route.
- [ ] execute   [ ] skip

### T110. Nothing validates frontend GraphQL selection sets against the Rust schema (site/src/graphql/queries.ts)
- Lenses: opportunistic
- Risk: medium
- Proposed fix: `site/src/graphql/__tests__/queries.test.ts` checks variable scalar types only, and `MockedProvider` never contacts the real schema, so a misspelled field name passes every test while rendering nothing in production. Concretely: had the 2026-08-05 batch written `approvedAtUtc` instead of `approvedAt`, the new test would still have been green. The name happened to be correct, so there is no live defect — but this is an unguarded dependency of exactly the shape CLAUDE.md warns about, and it is the invariant several frontend tests rest on. Options: generate TS types from the Rust schema (codegen), or add a test that introspects the running schema and asserts every field named in `queries.ts` exists.
- [ ] execute   [ ] skip

### T111. Apollo's missing-field diagnostic is inert under vitest (site/vite.config.ts, site/setupVitest.ts)
- Lenses: opportunistic
- Risk: low
- Proposed fix: `@apollo/client`'s `__DEV__`-gated diagnostics — including `"Missing field '%s' while writing result"` (`cache/inmemory/writeToStore.js:233`) — are disabled because `globalThis.__DEV__` is never defined; `site/vite.config.ts` does not `define` it. Separately `site/setupVitest.ts:9-12` mutes any `console.warn` containing `go.apollo.dev`, which covers essentially every Apollo warning. Net effect: the mechanism that would flag a mock fixture gone stale against a widened selection set is off in both directions. Several fixtures already under-specify their documents (`AdminCompletionReview.test.tsx` `PENDING_COMPLETION`, `WeeklyChoreView.test.tsx` `OTHER_USER_COMPLETION`, four story fixtures) — harmless today, but the next widening has no safety net. Define `__DEV__: true` in the vitest config and narrow the console filter.
- [ ] execute   [ ] skip

### T112. Argument order into `isChoreCompletedByUser` is unguarded: `BonusChoreSection` (site/src/components/BonusChoreSection.tsx)
- Lenses: opportunistic
- Risk: low
- Proposed fix: `BonusChoreSection.tsx:45` calls `isChoreCompletedByUser(chore.id, userId, todayDate)`. Both leading parameters are `number`, so swapping them type-checks and the whole suite stays green — T107 tests the hook directly but nothing pins the production wiring. Either add a `BonusChoreSection` integration test with a non-empty `listBonusChores` fixture, or make the swap unrepresentable by giving the predicate branded id types (see the sibling `/typecheck` skill).
- [ ] execute   [ ] skip

### T114. No shared protection against cold `React.lazy` transform races in tests (site/setupVitest.ts)
- Lenses: opportunistic
- Risk: low
- Proposed fix: T113 was fixed locally in `site/src/App.test.tsx` with a `beforeAll` that pre-imports the lazy modules reachable from `App.tsx`'s index route, so the cold Vite transform is paid inside a hook (10s `hookTimeout`) instead of inside `waitFor` (1s). That fix protects exactly one file. Any future test that does a bare `render(<App />)` — or otherwise triggers cold `React.lazy` resolution as the first file to need those modules — hits the identical race, and will present the same confusing signature: deterministic failure in isolation, intermittent failure in the full suite. If a second such test appears, hoist the warm-up into `site/setupVitest.ts` rather than copying the `beforeAll`. Not worth building for one call site today; recorded so the second occurrence is recognised immediately rather than re-debugged from scratch. See T113's history in git (`30e3cf1`) for the diagnosis.
- [ ] execute   [ ] skip

## Skip (do not re-flag in future runs)
