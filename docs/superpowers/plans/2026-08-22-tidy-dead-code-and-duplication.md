# Tidy Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 30 findings Steve marked `[x] execute` in `TIDY.md`, one commit per finding, stripping each finding from `TIDY.md` in the commit that fixes it.

**Architecture:** Twenty-four independent cleanup tasks grouped A–G. Group A removes unused manifest dependencies. Group B removes backend dead code and replaces a stringly-typed HTTP status check. Group C fixes two N+1 query patterns behind characterization tests. Group D closes an authorization/UI mismatch. Groups E–G delete frontend dead code and collapse duplication into existing-but-unused hooks and components.

**Tech Stack:** Rust (Axum, Diesel, Juniper), React 19 + TypeScript, Apollo Client, Vitest, Tailwind v4, yarn 1.x.

**Spec:** `docs/superpowers/specs/2026-08-22-tidy-dead-code-and-duplication-design.md`

## Global Constraints

- **`yarn` is not on the default PATH.** Every frontend command — including `git commit`, because the husky pre-commit hook runs `vitest` — must be prefixed with:
  `export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH`
- **Never pass `--no-verify` or `--allow-dirty`.** Bypassing the hook is a tidy red flag.
- **One commit per finding**, formatted `tidy(<lens>): <summary> [T<n>]`.
- **Strip the finding from `TIDY.md` in the same commit that fixes it.** Non-negotiable.
- **Do not refactor existing test files.** New characterization tests are welcome; edits to existing `__tests__/` or `#[cfg(test)]` blocks are only allowed where a task explicitly says so.
- **Line numbers in `TIDY.md` are stale** (triaged 2026-08-04 @ `b59bb45`; HEAD is `86965df`). Re-locate every target by symbol name.
- Money on the wire is **cents**; `UserBalance.balance` from YNAB is **whole dollars**, matched **by name**.
- Weekday bitmask is **Monday=1 … Sunday=64**, owned by `site/src/utils/weekdayBitmask.ts`.
- Fix only lint/clippy warnings your own change introduces. The 9 pre-existing clippy warnings stay.
- Baseline to hold or beat: `cargo build`/`clippy`/`test` clean, `yarn lint` clean at `--max-warnings 0`, `yarn build` clean, **151** frontend tests passing.

---

## Drift discovered during planning

Six findings no longer match the code they were written against. **Read this before starting.**

| Finding | Status | Consequence |
| --- | --- | --- |
| **T27** | **Already fixed.** `AdminCompletionReview` already renders `CompletionCard` at both sites with `showActions` and `actionsLayout="stacked"`. | Task 24 strips it as resolved. No code change. |
| **T35** | **Already fixed.** T6 landed `weekdayBitmask.ts`; `CreateChoreForm` already calls `dayNamesFromBitmask` / `bitmaskFromDayNames`. | Task 24 strips it as resolved. No code change. |
| **T31** | **Targets moved.** The three `ChoreCompletionDetail` sites now live in `hooks/useCompletionActions.ts`. The two `AdminCompletionReview` sites are deleted by T26 instead. | Task 22 covers the moved sites, and must run after Task 21. |
| **T34** | **Half done.** `initialChore?: Chore` is already typed. Only `onSubmit: (choreData: any, …)` remains. | Task 14 is smaller than written. |
| **T42** | **Premise partly stale.** The name collision is gone (`UserBalance.tsx` renamed its local copy to `formatBalance` and documents the unit split). There are **11** importers, not 7. | Task 20 is a unit-clarity refactor, not a shadowing fix. |
| **T52** | **Target moved** from `ChoreCompletionDetail.tsx` to `components/AddNoteForm.tsx`, which renders `+ Add Note` unconditionally. | Task 13 targets `AddNoteForm.tsx`. |

---

## File Structure

**Created:**
- `site/src/hooks/useErrorToast.ts` — the `if (error) toast.error(msg)` effect, once (T39)
- `site/src/page/RequireAdmin.tsx` — shared admin route guard + `OutletContext` (T40)
- `site/src/utils/currency.ts` — `formatCents` / `formatDollars` (T42)
- `site/src/components/ChoreCell.tsx` — the four cell states as guard clauses (T32)
- `site/src/utils/celebrate.ts` — claim-then-confetti helper (T32, partial T75)
- `site/src/components/AdminNav.tsx` — `ADMIN_NAV_ITEMS` + nav buttons (T41)
- `site/src/components/AppHeader.tsx` — header bar (T41)
- `site/src/hooks/useAdminSession.ts` — `/auth/me` bootstrapping (T41)

**Deleted:**
- `site/src/components/BorderedTableCell.tsx` (T28)
- `site/src/components/NavItem.tsx` (T36)

**Heavily modified:** `src/api/mod.rs` (T44/T45/T46/T47), `src/models.rs` (T55/T56), `site/src/components/AdminCompletionReview.tsx` (T26), `site/src/components/ChoreRow.tsx` (T32), `site/src/page/PageTemplate.tsx` (T41), `site/src/graphql/queries.ts` (T38).

---

# Group A — Dependency removal

### Task 1: Remove `chrono-tz` (T18)

**Files:**
- Modify: `Cargo.toml:61`

**Interfaces:**
- Consumes: nothing
- Produces: nothing

- [ ] **Step 1: Re-verify the dependency is unused**

```bash
git grep -nE 'chrono_tz|chrono-tz|\bTz\b' -- ':!Cargo.lock' ':!TIDY.md' ':!docs/'
```

Expected: only `Cargo.toml:61`. If anything else matches, stop and record it in the commit body instead of deleting.

- [ ] **Step 2: Delete the line**

```bash
sed -i '/^chrono-tz = /d' Cargo.toml
```

- [ ] **Step 3: Verify the build still succeeds**

Run: `cargo build 2>&1 | tail -3`
Expected: `Finished` with no errors.

- [ ] **Step 4: Strip the finding from TIDY.md**

Delete the whole `### T18.` block (heading through its `- [x] execute   [ ] skip` line) from `TIDY.md`.

- [ ] **Step 5: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add Cargo.toml Cargo.lock TIDY.md
git commit -m "tidy(dead-code): drop unused chrono-tz dependency [T18]"
```

---

### Task 2: Remove `axum-embed` (T19)

**Files:**
- Modify: `Cargo.toml:63`

- [ ] **Step 1: Re-verify unused**

```bash
git grep -nE 'axum_embed|axum-embed|ServeEmbed' -- ':!Cargo.lock' ':!TIDY.md' ':!docs/'
```

Expected: only `Cargo.toml:63`. `src/routes.rs` uses `rust_embed::RustEmbed` + `mime_guess` directly.

- [ ] **Step 2: Delete the line**

```bash
sed -i '/^axum-embed = /d' Cargo.toml
```

- [ ] **Step 3: Verify**

Run: `cargo build 2>&1 | tail -3`
Expected: `Finished`.

- [ ] **Step 4: Strip `### T19.` from `TIDY.md`**

- [ ] **Step 5: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add Cargo.toml Cargo.lock TIDY.md
git commit -m "tidy(dead-code): drop unused axum-embed dependency [T19]"
```

---

### Task 3: Remove `react-router` direct dependency (T20)

**Files:**
- Modify: `site/package.json` (the `"react-router"` line in `dependencies`)

- [ ] **Step 1: Re-verify every import goes through `react-router-dom`**

```bash
cd site && grep -rn "from 'react-router'" src || echo "NO BARE react-router IMPORTS"
```

Expected: `NO BARE react-router IMPORTS`. `react-router-dom@7` depends on `react-router`, so resolution is unaffected.

- [ ] **Step 2: Remove the dependency**

```bash
cd site && sed -i '/^    "react-router": /d' package.json
```

- [ ] **Step 3: Reinstall and verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn install && yarn lint && yarn build && yarn test --run
```

Expected: lint clean, build clean, 151 tests pass.

- [ ] **Step 4: Strip `### T20.` from `TIDY.md`**

- [ ] **Step 5: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/package.json site/yarn.lock TIDY.md
git commit -m "tidy(dead-code): drop react-router, imported only via react-router-dom [T20]"
```

---

### Task 4: Remove `rxjs` (T21)

**Files:**
- Modify: `site/package.json`

- [ ] **Step 1: Re-verify unused**

```bash
cd site && grep -rn "from 'rxjs'\|require('rxjs')" src || echo "NO RXJS IMPORTS"
```

Expected: `NO RXJS IMPORTS`. (`oidcSubject` is a substring false positive — ignore it.)

- [ ] **Step 2: Remove and reinstall**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && sed -i '/^    "rxjs": /d' package.json && yarn install
```

- [ ] **Step 3: Verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run
```

Expected: all clean, 151 tests pass.

- [ ] **Step 4: Strip `### T21.` from `TIDY.md`**

- [ ] **Step 5: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/package.json site/yarn.lock TIDY.md
git commit -m "tidy(dead-code): drop unused rxjs dependency [T21]"
```

---

### Task 5: Remove eight unloaded eslint plugins and their inert rules (T22)

**Files:**
- Modify: `site/package.json` (devDependencies)
- Modify: `site/eslint.config.js` (delete `n/*`, `node/*`, `react/*` rule entries)

**Interfaces:**
- Consumes: nothing
- Produces: an eslint config that registers exactly the plugins it imports

- [ ] **Step 1: Record what the flat config actually imports**

```bash
cd site && grep -n "^import\|require(" eslint.config.js
```

Expected imports (all of which **stay** in `package.json`): `@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-refresh`, `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-prettier/recommended`.

- [ ] **Step 2: Remove the eight unimported packages**

```bash
cd site
for p in eslint-config-react eslint-config-standard eslint-config-stylelint \
         eslint-plugin-import eslint-plugin-node eslint-plugin-promise \
         eslint-plugin-react eslint-plugin-storybook; do
  sed -i "/^    \"$p\": /d" package.json
done
grep -c 'eslint' package.json
```

**Careful:** `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y`, `eslint-plugin-prettier`, `eslint-config-prettier`, and `eslint` itself must survive. Confirm with `grep '"eslint' package.json` before continuing.

- [ ] **Step 3: Delete the inert rule entries**

Open `site/eslint.config.js` and delete every rule whose key begins `n/`, `node/`, or `react/` — their owning plugins are never registered, so the rules never ran. Leave `react-hooks/*`, `react-refresh/*`, `jsx-a11y/*`, `@typescript-eslint/*`, and `prettier/*` alone.

- [ ] **Step 4: Reinstall and verify lint still passes at zero warnings**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn install && yarn lint
```

Expected: clean exit. `yarn lint` runs with `--max-warnings 0`, so any rule that silently stopped applying would surface here as a new error — that is the check.

- [ ] **Step 5: Full verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn build && yarn test --run
```

Expected: build clean, 151 tests pass.

- [ ] **Step 6: Strip `### T22.` from `TIDY.md`**

- [ ] **Step 7: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/package.json site/yarn.lock site/eslint.config.js TIDY.md
git commit -m "tidy(dead-code): drop eight unloaded eslint plugins and their inert rules [T22]"
```

---

### Task 6: Remove stylelint and prettier-eslint (T23)

**Files:**
- Modify: `site/package.json` (devDependencies)

- [ ] **Step 1: Re-verify nothing invokes them**

```bash
cd .. && find . -name '.stylelintrc*' -o -name 'stylelint.config*' | grep -v node_modules || echo "NO STYLELINT CONFIG"
grep -n 'stylelint\|prettier-eslint' package.json site/package.json site/.lintstagedrc.json
```

Expected: no config file; matches only in the `devDependencies` blocks, never in a `scripts` entry or in `.lintstagedrc.json` (which runs only `eslint --fix` and `prettier --write`).

- [ ] **Step 2: Remove all three**

```bash
cd site
for p in stylelint stylelint-config-standard prettier-eslint; do
  sed -i "/^    \"$p\": /d" package.json
done
grep -n 'prettier' package.json
```

`prettier` and `eslint-plugin-prettier` must survive.

- [ ] **Step 3: Reinstall and verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn install && yarn lint && yarn build && yarn test --run
```

Expected: all clean, 151 tests pass.

- [ ] **Step 4: Strip `### T23.` from `TIDY.md`**

- [ ] **Step 5: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/package.json site/yarn.lock TIDY.md
git commit -m "tidy(dead-code): drop stylelint and prettier-eslint, which nothing invokes [T23]"
```

**Milestone:** Group A complete. Run the full suite: `cargo test` and `cd site && yarn test --run`.

---

# Group B — Backend dead code and idioms

### Task 7: Delete the never-mounted api_routes router and its handler (T44, T45)

**Files:**
- Modify: `src/api/mod.rs:14-20`

**Note:** T44 and T45 are one commit — deleting `api_routes` without `test` leaves `test` orphaned and unreferenced. The finding for T45 says "Do together with T44." Both findings get stripped in this commit.

- [ ] **Step 1: Re-verify neither is reachable**

```bash
git grep -n 'api_routes' -- ':!TIDY.md' ':!docs/'
git grep -n '/api/test' -- ':!TIDY.md' ':!docs/'
```

Expected: `api_routes` matches only its definition in `src/api/mod.rs`; `/api/test` matches nothing. `src/routes.rs::app()` nests only `/graphql`, `/auth`, `/images`.

- [ ] **Step 2: Delete both items**

Remove from `src/api/mod.rs`:

```rust
pub fn api_routes(_context: GraphQLContext) -> Router {
    Router::new().route("/test", get(test))
}

pub async fn test(_headers: HeaderMap) -> Result<impl IntoResponse, AppError> {
    Ok("test")
}
```

Then drop the imports that only they used: `axum::http::HeaderMap`, `Router`, and `routing::get`. The `use axum::{Router, http::StatusCode, routing::get};` line becomes `use axum::http::StatusCode;`. Also drop `use crate::context::GraphQLContext;` if nothing else in the file uses it.

- [ ] **Step 3: Verify no unused-import warnings appeared**

Run: `cargo clippy --all-targets 2>&1 | grep -c 'unused'`
Expected: `0`. If non-zero, remove the remaining unused imports.

- [ ] **Step 4: Verify build and tests**

Run: `cargo build && cargo test 2>&1 | tail -5`
Expected: builds clean, all tests pass.

- [ ] **Step 5: Strip both `### T44.` and `### T45.` from `TIDY.md`**

- [ ] **Step 6: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add src/api/mod.rs TIDY.md
git commit -m "tidy(dead-code): delete never-mounted api_routes and its test handler [T44][T45]"
```

---

### Task 8: Delete the unused err_wrapper helper (T46)

**Files:**
- Modify: `src/api/mod.rs:22-27`

- [ ] **Step 1: Re-verify zero callers**

```bash
git grep -n 'err_wrapper' -- ':!TIDY.md' ':!docs/'
```

Expected: only the definition.

- [ ] **Step 2: Delete the function and its now-dead imports**

Remove:

```rust
pub fn err_wrapper<T: Serialize>(result: anyhow::Result<T>) -> impl IntoResponse {
    match result {
        Ok(val) => (StatusCode::OK, Json(val)).into_response(),
        Err(err) => (StatusCode::NOT_FOUND, err.to_string()).into_response(),
    }
}
```

Then drop `use axum::Json;` and `use serde::Serialize;` — `err_wrapper` was their only user. `StatusCode` stays; `AppError::into_response` still needs it.

- [ ] **Step 3: Verify no warnings**

Run: `cargo clippy --all-targets 2>&1 | grep -c 'unused'`
Expected: `0`.

- [ ] **Step 4: Verify build and tests**

Run: `cargo build && cargo test 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 5: Strip `### T46.` from `TIDY.md`**

- [ ] **Step 6: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add src/api/mod.rs TIDY.md
git commit -m "tidy(dead-code): delete err_wrapper, which has no callers [T46]"
```

---

### Task 9: Replace string-matched HTTP status with a typed marker error (T47)

**Files:**
- Modify: `src/api/mod.rs` (add `Unauthorized`, rewrite `AppError::into_response`)
- Modify: `src/api/images.rs:23` (construct the marker)
- Test: `src/api/mod.rs` (new `#[cfg(test)] mod tests`)

**Interfaces:**
- Produces: `pub struct Unauthorized;` in `crate::api`, implementing `Display` + `std::error::Error`.

**Why a test is mandatory here:** the current code selects 401 by `self.0.to_string().starts_with("Unauthorized")`. That is an unguarded dependency on the message text — the moment any caller prepends `.context("…")`, the 401 silently becomes a 404. This is precisely the "invariant held only in prose" pattern the repo's spec discipline calls out, so the test that pins it is the load-bearing one.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `src/api/mod.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::{Context, anyhow};

    #[test]
    fn unauthorized_marker_maps_to_401() {
        let err = AppError(anyhow!(Unauthorized));
        assert_eq!(err.into_response().status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn unauthorized_survives_added_context() {
        // The bug this replaces: a prepended context string moved the message
        // off the "Unauthorized" prefix and silently downgraded 401 to 404.
        let err = AppError(
            anyhow::Error::from(Unauthorized).context("fetching user image"),
        );
        assert_eq!(err.into_response().status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn other_errors_map_to_404() {
        let err = AppError(anyhow!("something else went wrong"));
        assert_eq!(err.into_response().status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn a_message_merely_starting_with_unauthorized_is_not_special() {
        // Guards the reverse direction: status now comes from the type, not the text.
        let err = AppError(anyhow!("Unauthorized-looking message"));
        assert_eq!(err.into_response().status(), StatusCode::NOT_FOUND);
    }
}
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cargo test --lib api::tests 2>&1 | tail -20`
Expected: `unauthorized_marker_maps_to_401` fails (no `Unauthorized` type — compile error), which is the expected starting state.

- [ ] **Step 3: Add the marker type**

Add to `src/api/mod.rs`, above `AppError`:

```rust
/// Marker error selecting `401 Unauthorized` for [`AppError`]'s response.
///
/// The status is chosen by downcasting to this type rather than by matching the
/// error's message, so wrapping it in `.context(..)` cannot silently change the
/// status code.
#[derive(Debug)]
pub struct Unauthorized;

impl std::fmt::Display for Unauthorized {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Unauthorized")
    }
}

impl std::error::Error for Unauthorized {}
```

- [ ] **Step 4: Rewrite the response mapping**

Replace the body of `impl IntoResponse for AppError`:

```rust
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = if self.0.chain().any(|e| e.is::<Unauthorized>()) {
            StatusCode::UNAUTHORIZED
        } else {
            StatusCode::NOT_FOUND
        };
        (status, format!("Error: {}", self.0)).into_response()
    }
}
```

**Note:** use `self.0.chain().any(..)` rather than `downcast_ref`, so the marker is still found after `.context(..)` wraps it — that is what `unauthorized_survives_added_context` asserts.

Update the doc comment on `AppError` to say the status comes from an `Unauthorized` marker in the error chain, not from the message text.

- [ ] **Step 5: Update the one construction site**

In `src/api/images.rs`, change `require_admin_cookie`:

```rust
fn require_admin_cookie(context: &GraphQLContext, jar: &CookieJar) -> Result<i32, AppError> {
    admin_id_from_jar(context, jar)
        .map_err(AppError)?
        .ok_or_else(|| AppError(anyhow!(crate::api::Unauthorized)))
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cargo test --lib api::tests 2>&1 | tail -10`
Expected: 4 passed.

- [ ] **Step 7: Full verify**

Run: `cargo build && cargo clippy --all-targets 2>&1 | tail -3 && cargo test 2>&1 | tail -5`
Expected: clean, all tests pass.

- [ ] **Step 8: Strip `### T47.` from `TIDY.md`**

- [ ] **Step 9: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add src/api/mod.rs src/api/images.rs TIDY.md
git commit -m "tidy(idioms): pick 401 from a typed marker, not the error message [T47]"
```

---

### Task 10: Name the request body limit (T57)

**Files:**
- Modify: `src/api/images.rs` (add `MAX_UPLOAD_BODY_SIZE` next to `MAX_IMAGE_SIZE`)
- Modify: `src/routes.rs:87-89`

**Interfaces:**
- Produces: `pub const MAX_UPLOAD_BODY_SIZE: usize` in `crate::api::images`.

- [ ] **Step 1: Add the constant**

In `src/api/images.rs`, directly below `const MAX_IMAGE_SIZE: usize = 5 * 1024 * 1024;`:

```rust
/// Body-size ceiling for the multipart upload route.
///
/// One megabyte above [`MAX_IMAGE_SIZE`] to leave room for the multipart
/// envelope — boundary markers, per-part headers, and the trailing boundary —
/// so a file exactly at the image limit is rejected by the size check with its
/// own error rather than by the transport layer.
pub const MAX_UPLOAD_BODY_SIZE: usize = MAX_IMAGE_SIZE + 1024 * 1024;
```

`MAX_IMAGE_SIZE` is currently private; leave it private and keep the new constant `pub`.

- [ ] **Step 2: Use it in the router**

In `src/routes.rs`, replace:

```rust
        .layer(tower_http::limit::RequestBodyLimitLayer::new(
            6 * 1024 * 1024,
        ))
```

with:

```rust
        .layer(tower_http::limit::RequestBodyLimitLayer::new(
            crate::api::images::MAX_UPLOAD_BODY_SIZE,
        ))
```

Confirm the value is unchanged: `5 * 1024 * 1024 + 1024 * 1024 == 6 * 1024 * 1024`.

- [ ] **Step 3: Verify**

Run: `cargo build && cargo clippy --all-targets 2>&1 | tail -3 && cargo test 2>&1 | tail -5`
Expected: clean, all tests pass.

- [ ] **Step 4: Strip `### T57.` from `TIDY.md`**

- [ ] **Step 5: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add src/api/images.rs src/routes.rs TIDY.md
git commit -m "tidy(idioms): name the upload body limit so it cannot drift from MAX_IMAGE_SIZE [T57]"
```

**Milestone:** Group B complete. Run `cargo test` in full.

---

# Group C — Backend query efficiency

### Task 11: Remove the per-user image query from User::image_path (T55)

**Files:**
- Modify: `src/models.rs` (the `image_path` resolver on `User`)
- Test: `src/models.rs` or `src/svc/user_image.rs` (characterization test)

**Interfaces:**
- Consumes: `User.image_id`, already loaded by `User::as_select()`.
- Produces: `image_path` returning `Some("/images/user/{id}?v={image_id}")` when the user has an image, `None` otherwise.

**Background gathered during planning:**
- `image_id` **is** maintained: set on upload (`src/svc/user_image.rs:98`) and cleared on delete. Tests at `src/svc/user_image.rs:283-308` and `:432-471` already pin both directions, so `image_id.is_some()` ⟺ the user has an image.
- The frontend treats `imagePath` as an opaque `<img src>` (`site/src/components/UserImage.tsx:23`), so the URL shape may change.
- The route `/images/user/{user_id}` already exists (`src/api/images.rs`) and serves the newest image for that user.
- **Cache caveat:** `/images/{uuid}` is content-addressed, but `/images/user/{id}` is stable and served with `Cache-Control: public, max-age=86400`. Switching without a cache key would leave a changed avatar stale for a day. Appending `?v={image_id}` restores a changing key.

- [ ] **Step 1: Write the characterization test**

Add to the `#[cfg(test)] mod tests` in `src/svc/user_image.rs` (this is a **new** test, permitted by the one-way rule):

```rust
#[test]
fn image_path_is_none_without_an_image_and_versioned_with_one() {
    let context = crate::context::test_context();
    let user = crate::test_helpers::create_test_user(&context, "Avatar Kid");

    // No image yet -> no path.
    let reloaded = UserSvc::get(&context, &user.uuid).unwrap();
    assert_eq!(reloaded.image_path(&context), None);

    // After an upload the path is present and carries the image id as a cache key.
    let image = UserImageSvc::create(
        &context,
        user.id.unwrap(),
        "avatar.png",
        "image/png",
        vec![1, 2, 3],
    )
    .unwrap();

    let reloaded = UserSvc::get(&context, &user.uuid).unwrap();
    let path = reloaded.image_path(&context).expect("expected an image path");
    assert!(
        path.starts_with(&format!("/images/user/{}", user.id.unwrap())),
        "path should address the user route, got {path}"
    );
    assert!(
        path.contains(&image.id.to_string()),
        "path should carry the image id as a cache key, got {path}"
    );
}
```

**Adapt the helper names to whatever `src/test_helpers.rs` and `UserImageSvc` actually expose** — read them first; do not invent signatures.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cargo test --lib user_image::tests::image_path_is_none_without_an_image_and_versioned_with_one 2>&1 | tail -20`
Expected: FAIL — the current resolver returns `/images/{uuid}`, which contains neither the user route nor the image id.

- [ ] **Step 3: Rewrite the resolver**

In `src/models.rs`, replace:

```rust
    pub fn image_path(&self, context: &GraphQLContext) -> Option<String> {
        let image = UserImageSvc::get_by_user_id(context, self.id?);
        if let Ok(Some(image)) = image {
            if let Some(image_uuid) = image.uuid {
                return Some(format!("/images/{}", image_uuid));
            }
        }

        None
    }
```

with:

```rust
    /// URL for this user's profile image, or `None` when they have none.
    ///
    /// Answered entirely from the already-loaded `image_id` column: this
    /// resolver runs once per user in a result set, so querying `user_images`
    /// here fanned out to chores x users on nested selections. `image_id`
    /// is set on upload and cleared on delete, so its presence is equivalent
    /// to the row existing.
    ///
    /// `?v=` carries the image id because `/images/user/{id}` is a stable URL
    /// served with a 24h `Cache-Control`; without a changing key a replaced
    /// avatar would stay stale in the browser for a day.
    pub fn image_path(&self) -> Option<String> {
        let user_id = self.id?;
        let image_id = self.image_id?;
        Some(format!("/images/user/{user_id}?v={image_id}"))
    }
```

Note the `context` parameter is dropped — juniper allows resolvers without it. If any caller in `src/` invokes `image_path(context)` directly, update it; the test above calls `image_path(&context)`, so adjust the test to `image_path()` in the same step.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cargo test --lib user_image::tests::image_path_is_none_without_an_image_and_versioned_with_one 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 5: Check whether `UserImageSvc` is still imported by models.rs**

Run: `cargo clippy --all-targets 2>&1 | grep -i 'unused' | head`
Expected: empty. If `UserImageSvc` is now unused in `src/models.rs`, drop the import.

- [ ] **Step 6: Full verify**

Run: `cargo build && cargo test 2>&1 | tail -5`
Expected: clean, all tests pass.

- [ ] **Step 7: Strip `### T55.` from `TIDY.md`**

- [ ] **Step 8: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add src/models.rs src/svc/user_image.rs TIDY.md
git commit -m "tidy(opportunistic): serve image_path from the loaded image_id, dropping an N+1 [T55]"
```

---

### Task 12: Delegate Chore::assigned_users to the single-join service method (T56)

**Files:**
- Modify: `src/models.rs:372` (the `assigned_users` resolver)

**Interfaces:**
- Consumes: `ChoreSvc::get_assigned_users(context: &GraphQLContext, chore_id: i32) -> Result<Vec<User>>` (`src/svc/chore.rs:165`), which does `chore_assignments INNER JOIN users` in one query.

- [ ] **Step 1: Write the characterization test**

`src/svc/chore.rs` already has coverage of `get_assigned_users` (assign/unassign/duplicate cases at `:371-399`). The gap is that nothing pins the **resolver**. Add to the `#[cfg(test)] mod tests` in `src/svc/chore.rs`:

```rust
#[test]
fn assigned_users_resolver_matches_the_service_query() {
    let context = crate::context::test_context();
    let admin = crate::test_helpers::create_test_admin(&context);
    let chore = crate::test_helpers::create_test_chore(&context, admin.id);
    let user1 = crate::test_helpers::create_test_user(&context, "Alice");
    let user2 = crate::test_helpers::create_test_user(&context, "Bob");

    ChoreSvc::assign_user(&context, chore.id.unwrap(), user1.id.unwrap()).unwrap();
    ChoreSvc::assign_user(&context, chore.id.unwrap(), user2.id.unwrap()).unwrap();

    let via_resolver = chore.assigned_users(&context).unwrap();
    let via_service = ChoreSvc::get_assigned_users(&context, chore.id.unwrap()).unwrap();

    assert_eq!(
        via_resolver.iter().map(|u| u.id).collect::<Vec<_>>(),
        via_service.iter().map(|u| u.id).collect::<Vec<_>>(),
        "resolver and service must agree on both membership and order"
    );
}
```

**Adapt helper names to what `src/test_helpers.rs` actually exposes** — read it first.

- [ ] **Step 2: Run it against the unchanged resolver and confirm it PASSES**

Run: `cargo test --lib chore::tests::assigned_users_resolver_matches_the_service_query 2>&1 | tail -10`
Expected: PASS. This is a characterization test — it must pass **before** the change, pinning current behavior. If it fails, the two paths already disagree on ordering; stop and report that rather than "fixing" it silently.

- [ ] **Step 3: Commit the characterization test**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add src/svc/chore.rs
git commit -m "test: characterize Chore::assigned_users before tidy [T56]"
```

- [ ] **Step 4: Replace the resolver body**

In `src/models.rs`, replace the whole `assigned_users` body with:

```rust
    pub fn assigned_users(&self, context: &GraphQLContext) -> juniper::FieldResult<Vec<User>> {
        let chore_id = self.id.ok_or_else(|| {
            juniper::FieldError::new("Chore has no id", juniper::Value::null())
        })?;
        Ok(ChoreSvc::get_assigned_users(context, chore_id)?)
    }
```

Drop the now-unused `use crate::schema::chore_assignments::dsl::*;` and `use crate::schema::users::dsl as users_dsl;` from inside the function, along with the `debug!` on `assignments`. Add `use crate::svc::ChoreSvc;` at module level if not already imported (per the project's module-level import rule).

- [ ] **Step 5: Run the characterization test again**

Run: `cargo test --lib chore::tests::assigned_users_resolver_matches_the_service_query 2>&1 | tail -10`
Expected: still PASS — same users, same order, one query instead of two.

- [ ] **Step 6: Full verify**

Run: `cargo build && cargo clippy --all-targets 2>&1 | grep -c 'unused' && cargo test 2>&1 | tail -5`
Expected: `0` unused warnings, all tests pass.

- [ ] **Step 7: Strip `### T56.` from `TIDY.md`**

- [ ] **Step 8: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add src/models.rs TIDY.md
git commit -m "tidy(opportunistic): delegate assigned_users to the single-join service query [T56]"
```

**Milestone:** Group C complete. Run `cargo test` in full.

---

# Group D — Authorization surface

### Task 13: Gate the Add Note form on isAdmin (T52)

**Files:**
- Modify: `site/src/components/AddNoteForm.tsx`
- Test: `site/src/components/__tests__/AddNoteForm.test.tsx` (create if absent)

**Drift note:** the finding names `ChoreCompletionDetail.tsx`, but that file was refactored — the `+ Add Note` button now lives in `AddNoteForm.tsx:31-36`, which renders it unconditionally. `isAdmin` currently gates only the "Visible to user" checkbox at `:47`.

**Decision:** Steve's note on the finding — "we can make that admin-only" — settles it. Gate the UI; **do not** relax the resolver. `createChoreCompletionNote` keeps `require_admin`.

- [ ] **Step 1: Write the failing test**

Create `site/src/components/__tests__/AddNoteForm.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AddNoteForm from '../AddNoteForm';

describe('AddNoteForm', () => {
  it('renders the Add Note control for admins', () => {
    render(<AddNoteForm isAdmin onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
  });

  it('renders nothing for non-admins, because the mutation requires an admin session', () => {
    const { container } = render(<AddNoteForm isAdmin={false} onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /add note/i })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to non-admin when isAdmin is omitted', () => {
    render(<AddNoteForm onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /add note/i })).not.toBeInTheDocument();
  });
});
```

Match the import style and test setup of a neighbouring test file (e.g. `site/src/components/__tests__/ChoreAssigneeFilter.test.tsx`) before writing — do not assume `@testing-library/jest-dom` is auto-imported.

- [ ] **Step 2: Run and confirm the non-admin cases fail**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn test --run AddNoteForm 2>&1 | tail -20
```

Expected: the two non-admin tests FAIL — the button renders for everyone today.

- [ ] **Step 3: Gate the component**

In `site/src/components/AddNoteForm.tsx`, add an early return immediately after the `useState` declarations (hooks must stay above it so hook order is stable):

```tsx
  // `createChoreCompletionNote` requires an admin session server-side, so for a
  // kid this control could only ever produce an error toast. Kids' completions
  // are still visible to them via CompletionNotesList - only authoring is admin-only.
  if (!isAdmin) {
    return null;
  }
```

Leave the inner `{isAdmin && ...}` guard on the visibility checkbox alone, or simplify it now that the outer guard makes it redundant — either is fine, but do not change the checkbox's default.

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn test --run AddNoteForm 2>&1 | tail -10
```

Expected: 3 passed.

- [ ] **Step 5: Full verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -6
```

Expected: clean; test count rises from 151 to 154.

- [ ] **Step 6: Strip `### T52.` from `TIDY.md`**

- [ ] **Step 7: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src/components/AddNoteForm.tsx site/src/components/__tests__/AddNoteForm.test.tsx TIDY.md
git commit -m "tidy(opportunistic): hide the Add Note form from non-admins [T52]"
```

---

# Group E — Frontend dead code

### Task 14: Type CreateChoreForm's onSubmit prop (T34)

**Files:**
- Modify: `site/src/components/CreateChoreForm.tsx:11-18`

**Drift note:** `initialChore?: Chore` is already correctly typed. Only the `any` on `onSubmit` remains.

- [ ] **Step 1: Confirm the shape matches `ChoreInput`**

`ChoreInput` (`site/src/types/chore.ts:118`) is:

```ts
export interface ChoreInput {
  uuid?: string;
  name: string;
  description?: string;
  paymentType: PaymentType;
  amountCents: number;
  requiredDays: number;
  active?: boolean;
  createdByAdminId: number;
  availabilityWindow?: AvailabilityWindow | null;
}
```

The object built in `handleSubmit` supplies exactly these keys.

- [ ] **Step 2: Type the prop**

Add `ChoreInput` to the existing type import:

```ts
import { PaymentType, User, Chore, ChoreInput } from 'types/chore';
```

Then change the interface member:

```ts
  onSubmit: (choreData: ChoreInput, selectedUserIds: number[]) => Promise<void>;
```

- [ ] **Step 3: Remove the now-redundant cast**

`handleSubmit` reads `bitmaskFromDayNames(selectedDays as DayName[])`, but `selectedDays` is already `DayName[]`. Drop the cast:

```ts
    const requiredDays = bitmaskFromDayNames(selectedDays);
```

- [ ] **Step 4: Typecheck**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn build 2>&1 | tail -10
```

Expected: clean. If the two call sites in `AdminChoreManagement.tsx:154,183` or `stories/CreateChoreForm.stories.tsx` now mismatch, fix the call sites — do not widen the prop back to `any`.

- [ ] **Step 5: Full verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn test --run 2>&1 | tail -6
```

Expected: clean, tests pass.

- [ ] **Step 6: Strip `### T34.` from `TIDY.md`**

- [ ] **Step 7: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src/components/CreateChoreForm.tsx TIDY.md
git commit -m "tidy(idioms): type CreateChoreForm's onSubmit as ChoreInput [T34]"
```

---

### Task 15: Delete BorderedTableCell (T28)

**Files:**
- Delete: `site/src/components/BorderedTableCell.tsx`

- [ ] **Step 1: Re-verify zero references**

```bash
cd site && grep -rn '\bBorderedTableCell\b' src .storybook 2>/dev/null
```

Expected: only line 1 of its own definition. No story file references it.

- [ ] **Step 2: Delete the file**

```bash
git rm site/src/components/BorderedTableCell.tsx
```

- [ ] **Step 3: Verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -6
```

Expected: clean, tests pass.

- [ ] **Step 4: Strip `### T28.` from `TIDY.md`**

- [ ] **Step 5: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add -A site/src/components TIDY.md
git commit -m "tidy(dead-code): delete unreferenced BorderedTableCell [T28]"
```

---

### Task 16: Delete getVariant and the three commented clsx entries (T29, T30)

**Files:**
- Modify: `site/src/components/Button/ButtonTypes.ts` (delete `getVariant`)
- Modify: `site/src/components/Button/index.tsx:24,40,41` (delete three commented lines)

**Note:** one commit for both findings — T30 deletes `// getVariant(type, disabled),` at `index.tsx:40`, which is also T29's only remaining reference. Splitting them would leave a commented call to a deleted function.

- [ ] **Step 1: Re-verify**

```bash
cd site && grep -rn '\bgetVariant\b' src
```

Expected: exactly two lines — `ButtonTypes.ts:10` (definition) and `index.tsx:40` (commented out).

Confirm `ButtonTypes` itself stays:

```bash
cd site && grep -rn '\bButtonTypes\b' src | wc -l
```

Expected: well above 2 — the enum has many live references and must **not** be deleted.

- [ ] **Step 2: Delete `getVariant`**

Remove lines 10–26 of `site/src/components/Button/ButtonTypes.ts` — the entire `export const getVariant = (…) => { … };`. Keep `export enum ButtonTypes { … }`.

- [ ] **Step 3: Delete the three commented lines**

From `site/src/components/Button/index.tsx` remove:

```
    // 'text-black',
    // getVariant(type, disabled),
    // block && 'w-full',
```

(at lines 24, 40, 41 — delete by content, not by line number).

- [ ] **Step 4: Verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -6
```

Expected: clean, tests pass. If `block` is now an unused prop, leave it — removing a prop is a public-API change and is out of scope; note it in the commit body.

- [ ] **Step 5: Strip both `### T29.` and `### T30.` from `TIDY.md`**

- [ ] **Step 6: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src/components/Button TIDY.md
git commit -m "tidy(dead-code): delete getVariant and the commented clsx entries [T29][T30]"
```

---

### Task 17: Delete NavItem (T36)

**Files:**
- Delete: `site/src/components/NavItem.tsx`

**Decision:** Steve chose deletion over T41's reuse option. `NavItem` is an `<li><Link>` with white text and no active state; `PageTemplate`'s nav is `<button onClick={navigate}>` with active highlighting. They share no styling, so "reuse" would mean rewriting the file wholesale. Task 23 builds a fresh `AdminNav` instead.

- [ ] **Step 1: Re-verify zero references**

```bash
cd site && grep -rn '\bNavItem\b' src .storybook 2>/dev/null
```

Expected: only lines 3, 7, and 22 of `NavItem.tsx` itself.

- [ ] **Step 2: Delete**

```bash
git rm site/src/components/NavItem.tsx
```

- [ ] **Step 3: Verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -6
```

Expected: clean, tests pass.

- [ ] **Step 4: Strip `### T36.` from `TIDY.md`**

- [ ] **Step 5: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add -A site/src/components TIDY.md
git commit -m "tidy(dead-code): delete unused NavItem in favour of a fresh AdminNav [T36]"
```

**Milestone:** Group E complete. Run `cd site && yarn test --run`.

---

# Group F — Frontend duplication

### Task 18: Extract useErrorToast (T39)

**Files:**
- Create: `site/src/hooks/useErrorToast.ts`
- Modify: `site/src/hooks/useBalances.ts:16-18`, `site/src/hooks/useBonusChores.ts:34-36`, `site/src/hooks/useUserBadges.ts:17-19`

**Interfaces:**
- Produces: `useErrorToast(error: unknown, message: string): void`

- [ ] **Step 1: Create the hook**

`site/src/hooks/useErrorToast.ts`:

```ts
import { useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * Toasts `message` once whenever `error` becomes truthy.
 *
 * The declarative counterpart to `utils/withErrorToast`, which covers the
 * imperative half of the same concern: this one watches a query's `error`
 * field, that one wraps a mutation call.
 */
export function useErrorToast(error: unknown, message: string): void {
  useEffect(() => {
    if (error) toast.error(message);
  }, [error, message]);
}
```

**Note the `message` dependency:** the original effects listed only `[error]`. Including `message` is correct for exhaustive-deps and behaviourally identical as long as callers pass a string literal, which all three do.

- [ ] **Step 2: Replace the three copies**

In each of `useBalances.ts`, `useBonusChores.ts`, `useUserBadges.ts`:

- Delete the `useEffect(() => { if (error) toast.error('…'); }, [error]);` block.
- Add `import { useErrorToast } from './useErrorToast';`
- Call it with the same message the deleted block used:
  - `useBalances.ts` → `useErrorToast(error, 'Error loading balances');`
  - `useBonusChores.ts` → `useErrorToast(error, 'Error loading bonus chores');`
  - `useUserBadges.ts` → `useErrorToast(error, 'Error loading badges');`
- Drop the now-unused `useEffect` import from each file.
- Drop the `toast` import **only from the files that no longer use it**. `useBonusChores.ts` also imports `withErrorToast` and may still reference `toast` — check before deleting.

- [ ] **Step 3: Verify no unused imports remain**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint
```

Expected: clean. `--max-warnings 0` means a leftover unused import fails here.

- [ ] **Step 4: Full verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn build && yarn test --run 2>&1 | tail -6
```

Expected: clean, tests pass.

- [ ] **Step 5: Strip `### T39.` from `TIDY.md`**

- [ ] **Step 6: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src/hooks TIDY.md
git commit -m "tidy(duplication): extract useErrorToast from three hooks [T39]"
```

---

### Task 19: Extract RequireAdmin from three identical page files (T40)

**Files:**
- Create: `site/src/page/RequireAdmin.tsx`
- Modify: `site/src/page/AdminChoreManagementPage.tsx`, `site/src/page/AdminCompletionReviewPage.tsx`, `site/src/page/AdminPayoutSystemPage.tsx`

**Interfaces:**
- Produces: `export interface OutletContext { currentAdmin: Admin | null; isCheckingAuth: boolean }` and `export const RequireAdmin: React.FC<{ children: (admin: Admin) => React.ReactNode }>`

**Verified during planning:** all three files are 38 lines and byte-identical modulo the rendered component name. All three render `<X adminId={currentAdmin.id} />`.

- [ ] **Step 1: Create the shared guard**

`site/src/page/RequireAdmin.tsx`:

```tsx
import { useOutletContext } from 'react-router-dom';
import LoadingSpinner from 'components/LoadingSpinner';
import { Admin } from 'types/chore';

/** Shape PageTemplate publishes through its `<Outlet context={...} />`. */
export interface OutletContext {
  currentAdmin: Admin | null;
  isCheckingAuth: boolean;
}

const AccessDenied = () => (
  <div className="flex flex-col items-center justify-center min-h-96 text-center">
    <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
    <p className="text-gray-300 mb-6">You need to be logged in as an admin to access this page.</p>
    <button
      onClick={() => (window.location.href = '/auth/login')}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
    >
      Login as Admin
    </button>
  </div>
);

interface RequireAdminProps {
  /** Rendered only once an admin session is confirmed. */
  children: (admin: Admin) => React.ReactNode;
}

/**
 * Route guard for the three admin pages: spinner while the session check is in
 * flight, an Access Denied panel when there is no admin, and the child render
 * prop once an admin is confirmed.
 */
export const RequireAdmin = ({ children }: RequireAdminProps) => {
  const { currentAdmin, isCheckingAuth } = useOutletContext<OutletContext>();

  if (isCheckingAuth) return <LoadingSpinner />;
  if (!currentAdmin) return <AccessDenied />;

  return <>{children(currentAdmin)}</>;
};

export default RequireAdmin;
```

- [ ] **Step 2: Collapse the three page files**

`site/src/page/AdminChoreManagementPage.tsx` becomes:

```tsx
import AdminChoreManagement from 'components/AdminChoreManagement';
import RequireAdmin from './RequireAdmin';

export const AdminChoreManagementPage = () => (
  <RequireAdmin>{(admin) => <AdminChoreManagement adminId={admin.id} />}</RequireAdmin>
);

export default AdminChoreManagementPage;
```

Do the same for `AdminCompletionReviewPage.tsx` (rendering `AdminCompletionReview`) and `AdminPayoutSystemPage.tsx` (rendering `AdminPayoutSystem`).

- [ ] **Step 3: Re-point any importer of the old per-file `OutletContext`**

```bash
cd site && grep -rn 'OutletContext' src
```

Any file that declared or imported its own copy should now import it from `page/RequireAdmin`.

- [ ] **Step 4: Route the login buttons through the Button component**

The finding also notes the login button's class string is duplicated in `site/src/components/AdminHomePanel.tsx:14`. Read `site/src/components/Button/index.tsx` first to learn its actual props. **If the existing `Button` cannot reproduce these exact classes without changing its public props, skip this step** and note it in the commit body — a prop-signature change is out of scope for tidy. The `AccessDenied` markup above is correct either way.

- [ ] **Step 5: Verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -6
```

Expected: clean, tests pass.

- [ ] **Step 6: Strip `### T40.` from `TIDY.md`**

- [ ] **Step 7: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src/page site/src/components TIDY.md
git commit -m "tidy(duplication): extract RequireAdmin from three identical admin pages [T40]"
```

---

### Task 20: Split currency formatting by unit (T42)

**Files:**
- Create: `site/src/utils/currency.ts`
- Modify: `site/src/utils/dateUtils.ts` (remove `formatCurrency`)
- Modify: 11 importers + `site/src/components/UserBalance.tsx`
- Test: `site/src/utils/__tests__/currency.test.ts`

**Interfaces:**
- Produces: `formatCents(amountCents: number): string` and `formatDollars(amount: number, opts?: { zeroAs?: string }): string`

**Drift note:** the finding's "one shadowing the other's name" premise is stale — `UserBalance.tsx` already renamed its local copy to `formatBalance` and carries a comment warning against merging them. The remaining value is naming the unit at every call site. **Do not collapse the two functions.**

The **11** current importers of `formatCurrency` (all pass cents):
`CompletionCard.tsx`, `PayoutActionsPanel.tsx`, `BonusChoreSection.tsx`, `CompletionSummary.tsx`, `PayoutUserRow.tsx`, `PayoutSummaryCards.tsx`, `AdminPayoutSystem.tsx`, `ChoreRow.tsx`, `UserBalance.tsx`, `ChoreCard.tsx` — plus the definition in `dateUtils.ts`.

- [ ] **Step 1: Write the failing test**

`site/src/utils/__tests__/currency.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatCents, formatDollars } from '../currency';

describe('formatCents', () => {
  it('renders cents as dollars', () => {
    expect(formatCents(150)).toBe('$1.50');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(123456)).toBe('$1,234.56');
  });

  it('does not treat zero specially', () => {
    // The pending-earnings line relies on 0 rendering as a real amount.
    expect(formatCents(0)).not.toBe('-');
  });
});

describe('formatDollars', () => {
  it('renders whole dollars', () => {
    expect(formatDollars(12)).toBe('$12.00');
    expect(formatDollars(1234.5)).toBe('$1,234.50');
  });

  it('substitutes zeroAs when the amount is zero', () => {
    expect(formatDollars(0, { zeroAs: '-' })).toBe('-');
  });

  it('renders zero normally when zeroAs is not given', () => {
    expect(formatDollars(0)).toBe('$0.00');
  });
});

describe('the two units are not interchangeable', () => {
  it('reads the same number differently by a factor of 100', () => {
    // Guards the merge this split exists to prevent: YNAB balances are whole
    // dollars, every database money field is cents.
    expect(formatCents(1200)).toBe('$12.00');
    expect(formatDollars(1200)).toBe('$1,200.00');
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn test --run currency 2>&1 | tail -15
```

Expected: FAIL — `../currency` does not exist.

- [ ] **Step 3: Create the module**

`site/src/utils/currency.ts`:

```ts
/**
 * Currency formatting, split by unit.
 *
 * Two entry points on purpose. Every money field in our own database and on the
 * GraphQL wire is in **cents**; the YNAB-sourced `Balance.balance` is in whole
 * **dollars** and is matched to a kid by name rather than id. A single
 * `formatCurrency` taking "an amount" invited passing one where the other was
 * meant, which silently misreports by a factor of 100.
 */
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Formats an amount given in **cents** (our database and GraphQL wire format). */
export function formatCents(amountCents: number): string {
  return USD.format(amountCents / 100);
}

/**
 * Formats an amount given in whole **dollars** (the YNAB balance figure).
 *
 * `zeroAs` renders a placeholder instead of `$0.00` — the balance line uses
 * `'-'` so an empty YNAB account reads as "nothing to show" rather than a
 * confident zero.
 */
export function formatDollars(amount: number, opts?: { zeroAs?: string }): string {
  if (amount === 0 && opts?.zeroAs !== undefined) {
    return opts.zeroAs;
  }
  return USD.format(amount);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn test --run currency 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 5: Migrate the importers**

Remove `formatCurrency` from `site/src/utils/dateUtils.ts`. Then in each of the 10 component files, change the import and the call:

```ts
// before
import { formatCurrency } from '../utils/dateUtils';
// after
import { formatCents } from '../utils/currency';
```

…preserving each file's existing import style (some use `'utils/dateUtils'`, some `'../utils/dateUtils'`). `ChoreRow.tsx` imports `formatCurrency` **and** `isSameDayAsString` from `dateUtils` — split that into two imports, keeping `isSameDayAsString` where it is.

Every current call passes cents, so each `formatCurrency(x)` becomes `formatCents(x)`.

- [ ] **Step 6: Replace UserBalance's local copy**

In `site/src/components/UserBalance.tsx`: delete the local `formatBalance` function, import `formatCents` and `formatDollars` from `utils/currency`, then use:

- the balance line → `formatDollars(userBalance.balance, { zeroAs: '-' })`
- the pending line → `formatCents(pendingCents)`

Keep the existing `pendingCents` TSDoc — it documents the same unit split.

- [ ] **Step 7: Verify nothing still references the old name**

```bash
cd site && grep -rn '\bformatCurrency\b' src || echo "NO REMAINING REFERENCES"
```

Expected: `NO REMAINING REFERENCES`.

- [ ] **Step 8: Full verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -6
```

Expected: clean; test count rises by 7.

- [ ] **Step 9: Strip `### T42.` from `TIDY.md`**

- [ ] **Step 10: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src TIDY.md
git commit -m "tidy(duplication): split currency formatting into formatCents and formatDollars [T42]"
```

---

### Task 21: Adopt useWeeklyCompletions in AdminCompletionReview (T26)

**Files:**
- Modify: `site/src/hooks/useWeeklyCompletions.ts` (add `onMutated`)
- Modify: `site/src/components/AdminCompletionReview.tsx:27-82`

**Interfaces:**
- Consumes: `useWeeklyCompletions({ weekStartDate, onMutated })`
- Produces: `{ completions, pendingCompletions, approvedCompletions, loading, error, refetch, approveCompletion, deleteCompletion, addNote }`

**Verified during planning:** the hook exists at `site/src/hooks/useWeeklyCompletions.ts`, has **zero importers**, and already implements the query, the three mutations (through `useRefetchingMutation`, which refetches), `withErrorToast` wrapping, and the pending/approved split. It sets `fetchPolicy: 'cache-and-network'` and `pollInterval: 30_000` — **Steve accepted this polling change.**

Note the hook's `approveCompletion(completionUuid: string)` takes a **uuid string**, whereas the component's `handleApproveCompletion(completion: ChoreCompletion)` takes the whole object. `CompletionCard`'s `onApprove`/`onReject` pass a `ChoreCompletion`, so adapt at the call site.

- [ ] **Step 1: Add the `onMutated` option to the hook**

In `site/src/hooks/useWeeklyCompletions.ts`:

```ts
interface UseWeeklyCompletionsOptions {
  weekStartDate: Date;
  /** Runs after a successful approve/delete/note — e.g. to close a detail modal. */
  onMutated?: () => void;
}

export const useWeeklyCompletions = ({
  weekStartDate,
  onMutated,
}: UseWeeklyCompletionsOptions) => {
```

Then chain it onto the three actions, so it fires only on success:

```ts
  const approveCompletion = (completionUuid: string) =>
    withErrorToast('Error approving completion', () =>
      approveChoreCompletion({ variables: { completionUuid } }),
    ).then((result) => {
      onMutated?.();
      return result;
    });

  const deleteCompletion = (completionUuid: string) =>
    withErrorToast('Error deleting completion', () =>
      deleteChoreCompletion({ variables: { completionUuid } }),
    ).then((result) => {
      onMutated?.();
      return result;
    });
```

Leave `addNote` without `onMutated` — adding a note should not close the modal.

- [ ] **Step 2: Rewrite the component's data layer**

In `site/src/components/AdminCompletionReview.tsx`, delete lines 27–82 (the `useQuery`, both `useMutation`s, `handleApproveCompletion`, `handleRejectCompletion`, and the two local `.filter(...)` calls) and replace with:

```tsx
  const {
    pendingCompletions,
    approvedCompletions,
    loading,
    error,
    refetch,
    approveCompletion,
    deleteCompletion,
  } = useWeeklyCompletions({
    weekStartDate: weekRange.start,
    onMutated: () => setSelectedCompletion(null),
  });

  const handleApproveCompletion = (completion: ChoreCompletion) =>
    approveCompletion(completion.uuid);

  const handleRejectCompletion = async (completion: ChoreCompletion) => {
    if (!confirm('Are you sure you want to reject and delete this completion?')) {
      return;
    }
    await deleteCompletion(completion.uuid);
  };
```

**Keep the `confirm()` guard** — it is the only thing standing between a misclick and a deleted completion.

- [ ] **Step 3: Fix the imports**

Remove `useQuery`, `useMutation`, `toast`, `GET_ALL_WEEKLY_COMPLETIONS`, `APPROVE_CHORE_COMPLETION`, `DELETE_CHORE_COMPLETION`, and `formatDateForGraphQL` if now unused. Add `import { useWeeklyCompletions } from 'hooks/useWeeklyCompletions';`. Keep `getWeekDateRange` and `formatDateForDisplay` — the header still uses them.

- [ ] **Step 4: Check the modal's onUpdate**

The `<ChoreCompletionDetail onUpdate={...}>` at the bottom calls `refetch()` then `setSelectedCompletion(null)`. `refetch` is still returned by the hook, so this keeps working unchanged.

- [ ] **Step 5: Verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -8
```

Expected: clean, tests pass. If an existing `AdminCompletionReview` test mocks `GET_ALL_WEEKLY_COMPLETIONS` without `fetchPolicy`, the added `cache-and-network` may change how many times the mock is consumed — read the failure before touching the test, and prefer adding a mock over rewriting assertions.

- [ ] **Step 6: Strip `### T26.` from `TIDY.md`**

- [ ] **Step 7: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src TIDY.md
git commit -m "tidy(duplication): route AdminCompletionReview through useWeeklyCompletions [T26]"
```

---

### Task 22: Route mutation error handling through withErrorToast and kill the double toasts (T31)

**Files:**
- Modify: `site/src/hooks/useCompletionActions.ts` (3 sites)
- Modify: `site/src/components/AdminChoreManagement.tsx:80-93` (**delete** — double toast)
- Modify: `site/src/components/WeeklyChoreView.tsx:80-87` (**delete the catch** — double toast)
- Modify: `site/src/components/CreateUserForm.tsx:21-26` (verify, likely a third double toast)
- Modify: `site/src/components/AdminPayoutSystem.tsx:71-77`
- Test: `site/src/components/__tests__/` — a test that a failed assign toasts **once**

**Sequencing:** run this **after Task 21**, which deletes the two `AdminCompletionReview` sites the finding lists.

**Verified during planning — three live double-toast bugs:**

| Site | Callee | Callee already toasts? |
| --- | --- | --- |
| `AdminChoreManagement.handleAssignUser` | `useAdminChoreManagement.assignUser` | **Yes** — `withErrorToast('Error assigning user to chore', …)` |
| `AdminChoreManagement.handleUnassignUser` | `useAdminChoreManagement.unassignUser` | **Yes** — `withErrorToast('Error unassigning user from chore', …)` |
| `WeeklyChoreView.handleCompleteChore` | `useUserChores.completeChore` | **Yes** — `withErrorToast('Error completing chore', …)` |
| `CreateUserForm` submit | parent's `createUser` | **Verify** — `useAdminChoreManagement.createUser` wraps in `withErrorToast('Error creating user', …)`; confirm the parent passes it straight through |
| `AdminPayoutSystem` payout | check the hook | **Verify before wrapping** |
| `useCompletionActions` × 3 | raw `useMutation` | **No** — these are the genuine wrap targets |

- [ ] **Step 1: Write the failing test for the double toast**

Add to `site/src/components/__tests__/AdminChoreManagement.test.tsx` — a **new test in an existing file**, which the one-way rule permits (do not alter existing tests):

```tsx
it('toasts once, not twice, when assigning a user fails', async () => {
  const toastSpy = vi.spyOn(toast, 'error');
  // Render with a mocked ASSIGN_CHORE_TO_USER that errors, following the
  // existing mock style in this file, then trigger the assign action.
  // ...
  await waitFor(() => expect(toastSpy).toHaveBeenCalled());
  expect(toastSpy).toHaveBeenCalledTimes(1);
});
```

Read the file's existing mocking setup and reuse it rather than inventing a new harness.

- [ ] **Step 2: Run and confirm it fails with 2 calls**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn test --run AdminChoreManagement 2>&1 | tail -20
```

Expected: FAIL — `expected 1, received 2`. That failure **is** the bug.

- [ ] **Step 3: Delete the two redundant wrappers**

In `site/src/components/AdminChoreManagement.tsx`, delete `handleAssignUser` and `handleUnassignUser` entirely and pass the hook's functions straight through:

```tsx
        onAssign={assignUser}
        onUnassign={unassignUser}
```

Drop the `toast` import if nothing else in the file uses it (lines 63–77 keep their swallow-only catches, which do **not** toast — leave those alone; their comments already explain why).

- [ ] **Step 4: Delete WeeklyChoreView's redundant catch**

Replace `handleCompleteChore`:

```tsx
  const handleCompleteChore = async (choreId: number, completionDate: Date) => {
    // `completeChore` already toasts via withErrorToast; letting the rejection
    // propagate is load-bearing - ChoreRow catches it to suppress the confetti.
    await completeChore(choreId, completionDate);
    refetchAllCompletions();
  };
```

**This must keep throwing.** `ChoreRow`'s `handleComplete` catches the rejection to skip the confetti; swallowing it here would fire confetti on failure.

Drop the `toast` import from `WeeklyChoreView.tsx` if now unused.

- [ ] **Step 5: Wrap the three genuine sites in useCompletionActions**

In `site/src/hooks/useCompletionActions.ts`, replace each hand-written try/catch with `withErrorToast`. `addNote` must keep its `boolean` contract (its TSDoc explains that `AddNoteForm` uses it to decide whether to clear the form):

```ts
  const addNote = async (noteText: string, visibleToUser: boolean): Promise<boolean> => {
    if (!noteText.trim()) return false;

    try {
      await withErrorToast('Error adding note', () =>
        addChoreNote({
          variables: {
            note: {
              choreCompletionId: completion.id,
              noteText: noteText.trim(),
              authorType: isAdmin ? AuthorType.Admin : AuthorType.User,
              ...(isAdmin ? { authorAdminId: adminId } : { authorUserId: userId }),
              visibleToUser,
            },
          },
        }),
      );
      return true;
    } catch {
      // Already toasted by withErrorToast; the boolean is the caller's signal.
      return false;
    }
  };

  const approve = async () => {
    if (!isAdmin) return;
    await withErrorToast('Error approving completion', () =>
      approveChoreCompletion({ variables: { completionUuid: completion.uuid } }),
    ).catch(() => {});
  };

  const reject = async () => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to reject and delete this completion?')) return;
    await withErrorToast('Error rejecting completion', () =>
      deleteChoreCompletion({ variables: { completionUuid: completion.uuid } }),
    ).catch(() => {});
  };
```

`withErrorToast` **re-throws** by design, so `approve`/`reject` need the trailing `.catch(() => {})` to preserve their current non-throwing contract. Drop the `toast` import once no direct call remains.

- [ ] **Step 6: Handle CreateUserForm and AdminPayoutSystem**

For each: trace what `onSubmit` / the payout action actually calls. **If the callee already wraps in `withErrorToast`, delete the local try/catch** (it is another double toast). If it does not, convert the local try/catch to `withErrorToast`. Record which of the two you found in the commit body.

- [ ] **Step 7: Run the test and confirm it passes**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn test --run AdminChoreManagement 2>&1 | tail -10
```

Expected: PASS — exactly one toast.

- [ ] **Step 8: Full verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -8
```

Expected: clean, all tests pass.

- [ ] **Step 9: Strip `### T31.` from `TIDY.md`**

- [ ] **Step 10: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src TIDY.md
git commit -m "tidy(duplication): route mutations through withErrorToast, fixing three double toasts [T31]"
```

---

### Task 23: Introduce gql fragments in queries.ts (T38)

**Files:**
- Modify: `site/src/graphql/queries.ts`

- [ ] **Step 1: Declare the fragments at the top of the file**

After the `gql` import, add:

```ts
const USER_SUMMARY = gql`
  fragment UserSummary on User {
    id
    uuid
    name
    imagePath
  }
`;
```

Add `CHORE_SUMMARY`, `NOTE_FIELDS`, and `COMPLETION_FIELDS` the same way, **each matching the exact field set already selected** at the sites it will replace. Read every selection set before writing the fragment — if two sites differ by even one field, they do not share a fragment.

- [ ] **Step 2: Interpolate them**

```ts
export const GET_ALL_USERS = gql`
  ${USER_SUMMARY}
  query GetAllUsers {
    listUsers {
      ...UserSummary
    }
  }
`;
```

Apply to `GET_ALL_USERS`, `GET_USER_CHORES`, `GET_WEEKLY_CHORES`, `GET_ALL_CHORES`, `CREATE_USER`, `CREATE_CHORE`, `UPDATE_CHORE`, `ADD_CHORE_NOTE`.

**Two explicit exclusions:**
- **`GET_ALL_WEEKLY_COMPLETIONS`** asks for only `chore { id uuid name }`. Leave it inline — widening it to a full `ChoreSummary` grows every payload on the busiest polling query.
- **`GET_USER`** is unused and belongs to T80, which is **not** in this batch. Leave it exactly as it is.

- [ ] **Step 3: Verify the documents still parse and the shapes are unchanged**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn build && yarn test --run 2>&1 | tail -8
```

Expected: clean, tests pass. Apollo `MockedProvider` matches on the parsed document, so a changed selection set surfaces as a test failure here — that is the safety net. **If a test fails, the fragment changed the query; fix the fragment, not the test.**

- [ ] **Step 4: Lint**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint
```

Expected: clean.

- [ ] **Step 5: Strip `### T38.` from `TIDY.md`**

- [ ] **Step 6: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src/graphql/queries.ts TIDY.md
git commit -m "tidy(duplication): share gql fragments across queries.ts [T38]"
```

**Milestone:** Group F complete. Run `cd site && yarn test --run` and `cargo test`.

---

# Group G — Frontend structure

### Task 24: Add polling to the sibling weekly-completions query (T37)

**Files:**
- Modify: `site/src/components/WeeklyChoreView.tsx:69-75`

- [ ] **Step 1: Add the options**

```tsx
  // Same options as the other weekly consumers (useWeeklyCompletions,
  // useUserChores): without them the "completed by someone else" ticks went
  // stale while its partner query refreshed every 30s.
  const { data: allCompletionsData, refetch: refetchAllCompletions } = useQuery<{
    getAllWeeklyCompletions: ChoreCompletion[];
  }>(GET_ALL_WEEKLY_COMPLETIONS, {
    fetchPolicy: 'cache-and-network',
    variables: {
      weekStartDate: formatDateForGraphQL(weekRange.start),
    },
    pollInterval: 30_000,
  });
```

- [ ] **Step 2: Verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -8
```

Expected: clean, tests pass. If a `WeeklyChoreView` test now consumes its mock twice because of `cache-and-network`, add a second mock rather than removing the fetch policy.

- [ ] **Step 3: Strip `### T37.` from `TIDY.md`**

- [ ] **Step 4: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src/components/WeeklyChoreView.tsx TIDY.md
git commit -m "tidy(opportunistic): poll the sibling weekly-completions query [T37]"
```

---

### Task 25: Extract ChoreCell from ChoreRow (T32)

**Files:**
- Create: `site/src/components/ChoreCell.tsx`
- Create: `site/src/utils/celebrate.ts`
- Modify: `site/src/components/ChoreRow.tsx:36-113`
- Test: `site/src/components/__tests__/ChoreCell.test.tsx`

**Interfaces:**
- Produces: `celebrateOnSuccess(action: () => Promise<void>): Promise<void>` in `utils/celebrate.ts`
- Produces: `<ChoreCell chore date completion isScheduled isCompletedByAnyone onSelectCompletion onCompleteChore />`

**Scope note:** T75 (not in this batch) asks for the same confetti hoist plus a `BonusChoreSection` change and badge-chip extraction. Do **only** the `ChoreRow` half here. `BadgeChips` already exists, so T75's remaining scope is `BonusChoreSection.tsx` alone — leave it.

`renderChoreCell` currently spans `ChoreRow.tsx:36-113` (78 lines) and dispatches over four states: not scheduled → spacer; own completion → status pill; completed by someone else → grey check; otherwise → claim button.

- [ ] **Step 1: Write the characterization test**

`site/src/components/__tests__/ChoreCell.test.tsx` — cover all four states:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChoreCell from '../ChoreCell';

const baseProps = {
  chore: { id: 1, name: 'Dishes', requiredDays: 127, availabilityWindow: null },
  date: new Date('2026-08-19T12:00:00'),
  onSelectCompletion: vi.fn(),
  onCompleteChore: vi.fn(),
};

describe('ChoreCell', () => {
  it('renders an empty spacer when the day is not scheduled', () => {
    const { container } = render(
      <ChoreCell {...baseProps} completion={null} isScheduled={false} isCompletedByAnyone={false} />,
    );
    expect(container.querySelector('.w-8.h-8')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an approved pill for an approved completion', () => {
    render(
      <ChoreCell
        {...baseProps}
        completion={{ id: 9, approved: true, notes: [] }}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );
    expect(screen.getByTitle('Approved')).toHaveTextContent('✓');
  });

  it('renders a pending pill and a note count when notes exist', () => {
    render(
      <ChoreCell
        {...baseProps}
        completion={{ id: 9, approved: false, notes: [{ noteText: 'hi' }] }}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );
    expect(screen.getByTitle('Pending approval')).toHaveTextContent('?');
    expect(screen.getByTitle('hi')).toBeInTheDocument();
  });

  it('renders a grey check when someone else already did it', () => {
    render(
      <ChoreCell {...baseProps} completion={null} isScheduled isCompletedByAnyone />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a claim button that is disabled for future dates', () => {
    render(
      <ChoreCell
        {...baseProps}
        date={new Date(Date.now() + 86_400_000)}
        completion={null}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );
    expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
  });
});
```

Adapt the fixture shapes to the real `ChoreCompletion` / `WeeklyChoreData` types before running.

- [ ] **Step 2: Run and confirm it fails**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn test --run ChoreCell 2>&1 | tail -15
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the confetti helper**

`site/src/utils/celebrate.ts`:

```ts
import confetti from 'canvas-confetti';

/**
 * Runs `action` and fires confetti only if it resolves.
 *
 * The rejection is swallowed deliberately: the mutation layer already toasted
 * it via `withErrorToast`, and the only thing left to decide here is whether to
 * celebrate. Do not "improve" this by re-throwing without checking the callers.
 */
export async function celebrateOnSuccess(action: () => Promise<void>): Promise<void> {
  try {
    await action();
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  } catch {
    // Already handled and toasted upstream; just skip the confetti.
  }
}
```

- [ ] **Step 4: Create ChoreCell with guard-clause returns**

`site/src/components/ChoreCell.tsx` — move the four branches out of `renderChoreCell` verbatim, and hoist the notes helper to module scope:

```tsx
/** Joins a completion's notes into a tooltip string, or '' when there are none. */
const notesTooltip = (completion: ChoreCompletion | null): string => {
  if (!completion?.notes?.length) return '';
  return completion.notes.map((note) => note.noteText).join('\n');
};
```

Then the component, with each state as an early return in the same order as today: `!isScheduled` → spacer, `completion` → status pill + note count, `isCompletedByAnyone` → grey check, default → claim button calling `celebrateOnSuccess(() => onCompleteChore(chore.id, date))`.

Keep every Tailwind class string byte-identical — this is a structural refactor, not a restyle.

- [ ] **Step 5: Rewrite ChoreRow to use it**

Delete `renderChoreCell` and `getCompletionForDate`'s inline use; keep `getCompletionForDate` as a local helper and render:

```tsx
<ChoreCell
  chore={choreData.chore}
  date={date}
  completion={getCompletionForDate(date)}
  isScheduled={
    isDayInBitmask(choreData.chore.requiredDays, date) &&
    isDateInWindow(choreData.chore.availabilityWindow, date)
  }
  isCompletedByAnyone={isChoreCompletedByAnyone(choreData.chore.id, date)}
  onSelectCompletion={onSelectCompletion}
  onCompleteChore={onCompleteChore}
/>
```

at both the mobile (`:131`) and desktop (`:155`) call sites. Carry the availability-window comment across with the `isScheduled` computation — it documents that the server enforces the same rule in `ChoreCompletionSvc::create` and that this is only an affordance.

Drop the now-unused `confetti` and `clsx` imports from `ChoreRow.tsx` if nothing else uses them.

- [ ] **Step 6: Run the tests and confirm they pass**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn test --run ChoreCell 2>&1 | tail -10
```

Expected: 5 passed.

- [ ] **Step 7: Full verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -8
```

Expected: clean. Any existing `ChoreRow` test must still pass **unmodified** — if one fails, the extraction changed behavior; fix the component.

- [ ] **Step 8: Strip `### T32.` from `TIDY.md`**

- [ ] **Step 9: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src TIDY.md
git commit -m "tidy(long-methods): extract ChoreCell and celebrateOnSuccess from ChoreRow [T32]"
```

---

### Task 26: Break up PageTemplate (T41)

**Files:**
- Create: `site/src/components/AdminNav.tsx`
- Create: `site/src/components/AppHeader.tsx`
- Create: `site/src/hooks/useAdminSession.ts`
- Modify: `site/src/page/PageTemplate.tsx`

**Interfaces:**
- Produces: `useAdminSession(): { currentAdmin: Admin | null; isCheckingAuth: boolean }`
- Produces: `<AdminNav items pathname onNavigate />`, `<AppHeader currentAdmin isCheckingAuth onLogin onLogout />`

**Depends on Task 17** having deleted `NavItem.tsx` — `AdminNav` is written fresh from PageTemplate's existing button markup.

- [ ] **Step 1: Extract the session hook**

`site/src/hooks/useAdminSession.ts` — move `checkAdminSession` (currently module-level in `PageTemplate.tsx:11-28`) and the `useState`/`useEffect` pair verbatim:

```ts
/**
 * Resolves the current admin session once on mount.
 *
 * `isCheckingAuth` starts true so callers can distinguish "no admin" from
 * "not known yet" — the header renders neither nav nor a login button during
 * the check, and the admin pages show a spinner.
 */
export const useAdminSession = (): { currentAdmin: Admin | null; isCheckingAuth: boolean } => {
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    checkAdminSession().then((admin) => {
      setCurrentAdmin(admin);
      setIsCheckingAuth(false);
    });
  }, []);

  return { currentAdmin, isCheckingAuth };
};
```

Keep `checkAdminSession`'s existing TSDoc — it documents the toast-on-failure behavior.

- [ ] **Step 2: Extract AdminNav**

`site/src/components/AdminNav.tsx`:

```tsx
export interface AdminNavItem {
  path: string;
  label: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { path: '/admin/chores', label: 'Chore Management' },
  { path: '/admin/reviews', label: 'Review Completions' },
  { path: '/admin/payouts', label: 'Payout System' },
];

interface AdminNavProps {
  items: AdminNavItem[];
  pathname: string;
  onNavigate: (path: string) => void;
}

export const AdminNav = ({ items, pathname, onNavigate }: AdminNavProps) => (
  <nav className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
    {items.map(({ path, label }) => (
      <button
        key={path}
        onClick={() => onNavigate(path)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
          pathname === path
            ? 'bg-blue-600 text-white'
            : 'text-gray-300 hover:text-white hover:bg-gray-700'
        }`}
      >
        {label}
      </button>
    ))}
  </nav>
);

export default AdminNav;
```

This replaces `PageTemplate.tsx:73-104` with identical rendered output.

- [ ] **Step 3: Extract AppHeader**

`site/src/components/AppHeader.tsx` — move the whole `<header>` block (`PageTemplate.tsx:54-124`), taking `currentAdmin`, `isCheckingAuth`, `onLogin`, `onLogout`, `pathname`, and `onNavigate` as props, and rendering `<AdminNav items={ADMIN_NAV_ITEMS} … />` in place of the three inline buttons. Preserve the `!isCheckingAuth ? … : null` ternary exactly — it is what stops the Admin Login button from flashing during the session check.

- [ ] **Step 4: Collapse PageTemplate**

```tsx
export const PageTemplate = () => {
  const { currentAdmin, isCheckingAuth } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col text-white min-h-screen bg-gray-900">
      <AppHeader
        currentAdmin={currentAdmin}
        isCheckingAuth={isCheckingAuth}
        pathname={location.pathname}
        onNavigate={navigate}
        onLogin={() => (window.location.href = '/auth/login')}
        onLogout={() => (window.location.href = '/auth/logout')}
      />

      <div className="flex-1 flex flex-col">
        <div className="flex flex-col p-4 md:p-10">
          <Outlet context={{ currentAdmin, isCheckingAuth }} />
        </div>
        <Footer />
      </div>
    </div>
  );
};
```

The `<Outlet context={...} />` shape must stay exactly `{ currentAdmin, isCheckingAuth }` — `RequireAdmin` (Task 19) reads it.

- [ ] **Step 5: Verify**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -8
```

Expected: clean, all tests pass.

- [ ] **Step 6: Strip `### T41.` from `TIDY.md`**

- [ ] **Step 7: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add site/src TIDY.md
git commit -m "tidy(long-methods): split PageTemplate into AppHeader, AdminNav and useAdminSession [T41]"
```

---

# Wrap-up

### Task 27: Strip the two already-resolved findings (T27, T35)

**Files:**
- Modify: `TIDY.md`

Both were fixed by earlier work and must not linger in the findings file.

- [ ] **Step 1: Confirm T27 is resolved**

```bash
cd site && grep -n 'CompletionCard\|actionsLayout' src/components/AdminCompletionReview.tsx
```

Expected: `CompletionCard` rendered at both the pending and approved sites, the pending one carrying `showActions` and `actionsLayout="stacked"`. No inlined card markup remains.

- [ ] **Step 2: Confirm T35 is resolved**

```bash
cd site && grep -n 'dayNamesFromBitmask\|bitmaskFromDayNames\|requiredDays &' src/components/CreateChoreForm.tsx
```

Expected: both helpers imported from `utils/weekdayBitmask` and used; **zero** `requiredDays & <literal>` tests.

- [ ] **Step 3: Strip both `### T27.` and `### T35.` from `TIDY.md`**

- [ ] **Step 4: Commit**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
git add TIDY.md
git commit -m "docs(tidy): strip T27 and T35, already resolved by earlier work"
```

---

### Task 28: Final verification

- [ ] **Step 1: Confirm every executed finding is gone from TIDY.md**

```bash
for t in 18 19 20 21 22 23 26 27 28 29 30 31 32 34 35 36 37 38 39 40 41 42 44 45 46 47 52 55 56 57; do
  grep -q "^### T$t\." TIDY.md && echo "STILL PRESENT: T$t"
done
echo "--- strip check done ---"
```

Expected: no `STILL PRESENT` lines.

- [ ] **Step 2: Confirm unchecked findings survived**

```bash
grep -c '^### T' TIDY.md
grep -n '^### T\(15\|75\|80\)\.' TIDY.md
```

Expected: T15 (skipped), T75 and T80 (unchecked) all still present, along with every other unchecked finding.

- [ ] **Step 3: Full backend suite**

```bash
cargo build && cargo clippy --all-targets 2>&1 | tail -3 && cargo test 2>&1 | tail -6
```

Expected: builds clean, clippy at or below the 9-warning baseline, all tests pass.

- [ ] **Step 4: Full frontend suite**

```bash
export PATH=/home/steve/.nvm/versions/node/v24.19.0/bin:$PATH
cd site && yarn lint && yarn build && yarn test --run 2>&1 | tail -8
```

Expected: lint clean at `--max-warnings 0`, build clean, **more than 151** tests passing (new tests from Tasks 9, 11, 13, 20, 22, 25).

- [ ] **Step 5: Confirm one commit per finding**

```bash
git log --oneline main..HEAD | cat
```

Expected: a `tidy(...)` commit per finding plus the spec, plan, characterization, and wrap-up commits. No bulk commits, no `--no-verify`.

- [ ] **Step 6: Report**

Summarize: findings applied, findings found already-resolved, any converted to `decision-needed`, and the final test counts. No summary commit — the per-finding commits are the audit trail.
