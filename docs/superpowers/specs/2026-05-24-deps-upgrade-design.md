# 2026-05-24 — chore-tracker dependency upgrade

## Goal

Bring every dependency in `chore-tracker` to the latest stable version available on 2026-05-24, in staged commits, with the working tree releasable after every stage. Cover **both** manifests:

- `Cargo.toml` at the repo root (Rust backend)
- `site/package.json` (React/TS frontend, yarn classic 1.x)

Each stage produces one commit on `deps/2026-05-24`. A failed stage can be reverted in isolation.

## Hold list (deliberate non-upgrades)

- **`reqwest`** — held at `0.12.24`. User-requested deferral; do not include in any stage. The within-range `0.12.28` patch is also held to keep all of reqwest at the current minor.

## Baseline (Stage 0)

Verified 2026-05-24 on commit `4d21333` (deps/2026-05-24 branch tip):

**Rust:**
- `cargo build` — green
- `cargo clippy --all-targets` — green (project lints are `#![warn(...)]`, not `#![deny(...)]`; ~10 preexisting warnings; do NOT introduce new ones)
- `cargo test` — 63 lib + 0 bin + 2 doctests pass

**TS (`cd site`):**
- `yarn lint` — green (`eslint --max-warnings 0`)
- `yarn build` — green (tsc + vite build)
- `yarn test --run` — 11/11 pass on warm run. `App.test.tsx` is known-flaky on first cold run (suspense lazy-load timing for `HomePage`); recovers on second run. This is preexisting (existed pre-tidy) and not in scope to fix here.

## Outdated audit at write time

### Rust (cargo outdated --root-deps-only)

Within-range bumps (Stage R-1 batch):
| Package | Current | Latest |
|---|---|---|
| anyhow | 1.0.100 | 1.0.102 |
| axum | 0.8.6 | 0.8.9 |
| chrono | 0.4.42 | 0.4.44 |
| diesel | 2.3.3 | 2.3.9 |
| diesel_migrations | 2.3.0 | 2.3.2 |
| juniper | 0.17.0 | 0.17.1 |
| rust-embed | 8.8.0 | 8.11.0 |
| serde_json | 1.0.145 | 1.0.150 |
| tokio | 1.48.0 | 1.52.3 |
| tower | 0.5.2 | 0.5.3 |
| tower-http | 0.6.6 | 0.6.11 |
| tracing | 0.1.41 | 0.1.44 |
| tracing-subscriber | 0.3.20 | 0.3.23 |
| uuid | 1.18.1 | 1.23.1 |

Cross-major (own stage each):
| Package | Current | Latest | Risk |
|---|---|---|---|
| jsonwebtoken | 9.3.1 | 10.4.0 | Auth — used inside `OidcConfig::verify_id_token`. Single call site, well-isolated. |
| axum-extra | 0.10.3 | 0.12.6 | Two pre-1.0 minor bumps (0.10 → 0.11 → 0.12). Used for `CookieJar` and `Query` extractors throughout `src/auth.rs` and `src/routes.rs`. |

**Held:** `reqwest 0.12.24 → 0.13.3` and `reqwest 0.12.24 → 0.12.28` (per user instruction).

### TS (yarn outdated, site/)

Within-range (Stage T-1 batch — ~26 packages including patches and the storybook 8.6.17 → 8.6.18 patch family):
@apollo/client (3.14.0→3.14.1), @fortawesome/react-fontawesome (3.2.0→3.3.1), @storybook/* (8.6.17→8.6.18), @tailwindcss/vite (4.2.1→4.3.0), @types/node (25.3.3→25.9.1), @types/react (19.2.14→19.2.15), @typescript-eslint/* (8.56.1→8.59.4), @vitejs/plugin-react (5.1.4→5.2.0), @vitest/coverage-v8 (4.0.18→4.1.7), autoprefixer (10.4.27→10.5.0), eslint (10.0.2→10.4.0), eslint-plugin-promise (7.2.1→7.3.0), eslint-plugin-react-hooks (7.0.1→7.1.1), globals (17.4.0→17.6.0), graphql (16.13.1→16.14.0), prettier (3.8.1→3.8.3), react (19.2.4→19.2.6), react-dom (19.2.4→19.2.6), react-router (7.13.1→7.15.1), react-router-dom (7.13.1→7.15.1), react-toastify (11.0.5→11.1.0), storybook (8.6.17→8.6.18), stylelint (17.4.0→17.12.0), tailwindcss (4.2.1→4.3.0), typescript-eslint (8.56.1→8.59.4), uuid (13.0.0→13.0.2), vite (7.3.1→7.3.3), vite-plugin-compression2 (2.5.0→2.5.3), vitest (4.0.18→4.1.7).

Cross-major (own stage / synchronized family per stage):
| Package(s) | From → To | Family / notes |
|---|---|---|
| typescript | 5.9.3 → 6.0.3 | Compiler. Affects every file via type-check. |
| jsdom + vitest + @vitest/coverage-v8 | jsdom 28 → 29; vitest already 4.x but jsdom is its DOM impl | jsdom alone — vitest 4.x already supports it. Bundle jsdom in the test-stack stage. |
| vite + @vitejs/plugin-react + vite-plugin-svgr | vite 7→8; @vitejs/plugin-react 5→6; vite-plugin-svgr 4→5 | Vite family. Bundle. |
| storybook family | storybook 8→10; @storybook/addon-links 8→10; @storybook/react 8→10; @storybook/react-vite 8→10; eslint-plugin-storybook 0.12→10.4; @chromatic-com/storybook 3→5 | Storybook synchronized release. Bundle. |
| uuid | 13 → 14 | Standalone. ESM-only changes possible. |
| @apollo/client | 3 → 4 | Largest single-package migration in this batch. Touches every hook in `site/src/hooks/`. |

## Staging principles (verbatim from the skill)

- **Stage 0**: baseline only (done).
- **Stage 1**: all within-major patch/minor in one commit per manifest.
- **Stages 2+**: one major-family per stage.
  - Plugin packages move with their host.
  - Synchronized release families (storybook, vite ecosystem) bundle together.
  - Order from lowest to highest blast radius: tooling → typesystem → test stack → smaller-scope libs → data/network → CSS → core UI framework.
- **No major boundary crossings outside their own stage.**
- **No package-manager substitutions.** `cargo` and `yarn` (1.x) only.

## Stage list

The two manifests are independent — Rust stages do not interact with TS stages and vice versa. They could in principle run in parallel, but for clarity and audit-trail simplicity we run them **sequentially**: Rust first (smaller surface), then TS.

### Rust stages

**R-1. Within-range patch/minor batch.** Run `cargo update` (which respects `Cargo.toml` ranges) for the 14 packages above, EXCLUDING `reqwest` (use `cargo update --workspace --exclude reqwest` — or update each by name). Verify: build, clippy, test.

**R-2. jsonwebtoken 9 → 10.** Edit `Cargo.toml` (`jsonwebtoken = "10"`), `cargo update -p jsonwebtoken`. Migration notes: review release notes 9 → 10 for any API changes to `decode`, `decode_header`, `DecodingKey::from_jwk`, `Validation::new`, `Validation::set_issuer`, `Validation::set_audience` — these are the surface area used in `src/auth.rs`. Verify build + test (especially anything exercising the OIDC flow).

**R-3. axum-extra 0.10 → 0.12.** Edit `Cargo.toml` (`axum-extra = { version = "0.12", features = [...] }`), `cargo update -p axum-extra`. Migration notes: confirm `CookieJar`, `Cookie::build`, and `Query` import paths still work; the two-jump (0.10 → 0.11 → 0.12) may include extractor-trait or response-type changes. Touches `src/auth.rs` and `src/routes.rs`. Verify build, clippy, test.

### TS stages

**T-1. Within-range patch/minor batch.** Run `yarn upgrade` package-by-package for the ~26 outdated within-range packages (`yarn upgrade` with no args only updates `yarn.lock`; we want manifest ranges rewritten too where applicable). Verify: lint, build, vitest, dev-server smoke.

**T-2. typescript 5 → 6.** `yarn upgrade typescript --latest`. Migration: TypeScript 6 is expected to surface stricter `noImplicitAny` and `exactOptionalPropertyTypes` semantics (release notes pending review). Fix any new type errors that surface in `tsc --noEmit`. Verify: lint, build, test.

**T-3. Test stack — jsdom 28 → 29.** `yarn upgrade jsdom --latest`. Verify vitest (which uses jsdom for DOM environment) still works.

**T-4. Vite family — vite 7 → 8, @vitejs/plugin-react 5 → 6, vite-plugin-svgr 4 → 5.** All three together in a single commit. Plugins move with the host. Migration: review `vite.config.ts`, especially `plugins:` array. Verify: build (clean rebuild), dev-server smoke.

**T-5. Storybook family — storybook 8 → 10, @storybook/addon-links 8 → 10, @storybook/react 8 → 10, @storybook/react-vite 8 → 10, eslint-plugin-storybook 0.12 → 10.4, @chromatic-com/storybook 3 → 5.** Synchronized release. Run `yarn upgrade storybook @storybook/addon-links @storybook/react @storybook/react-vite eslint-plugin-storybook @chromatic-com/storybook --latest`. Migration: storybook 9 introduced major changes to addon API; 10 may have further. Likely requires `.storybook/main.ts` config edits. Verify: lint, `yarn storybook` smoke (start, curl http://localhost:6006, kill).

**T-6. uuid 13 → 14.** `yarn upgrade uuid --latest`. The Rust uuid crate is independent; only the `site/src/` callers and `import { v4 } from 'uuid'` calls need verification. Check for ESM/CJS interop changes. Verify: lint, build, test.

**T-7. @apollo/client 3 → 4.** `yarn upgrade @apollo/client --latest`. Largest migration: touches every hook in `site/src/hooks/`. Apollo 4 changes include split `@apollo/client/react` package, `useSuspenseQuery`/`useReadQuery` becoming primary, `InMemoryCache` config changes, and possible breaking changes to `useMutation` tuple return shape — the `useRefetchingMutation` helper introduced during the recent tidy pass may need adjustment.

## Per-stage workflow (verbatim from the skill)

1. Baseline check — parent commit lints, tests, builds clean (this is guaranteed for sequential stages on a green branch).
2. **For each stage 2+:** write a small characterization test in `<src-test-dir>/upgrade-tests/<topic>.test.<ext>` exercising the API surface most likely to break. Run it red→green against the *current* version; it must pass before the upgrade. Re-run after the upgrade; it must still pass.
3. Apply the upgrade with the appropriate package-manager command (`cargo update -p`, `cargo upgrade`, `yarn upgrade --latest`).
4. Apply migration changes for breaking APIs. Preserve behavior; no opportunistic refactors.
5. Verification quartet:
   - `<pm> lint` (cargo clippy / yarn lint)
   - `<pm> test --run` (cargo test / yarn test --run)
   - `<pm> build` (cargo build / yarn build)
   - Dev-server smoke (for T-4, T-5, T-7 and any other stage that touches UI/build/routing). For Rust: `cargo run` in background, `curl http://localhost:7007/healthz` or `/` → 200, kill. For TS: `yarn dev` in background (proxy to backend not needed for static-html), curl `http://localhost:5173/` → 200, kill. For T-5: `yarn storybook` in background, curl `http://localhost:6006/` → 200, kill.
6. Commit `chore(deps): stage <N> - <one-line summary>` with body listing every package + version delta.
7. No `--amend`. No `--no-verify`.

## Implementation discipline

Use `superpowers:subagent-driven-development` for execution. Sequential dispatch — one subagent per stage. Coordinator reviews each commit's diff and verification output before dispatching the next.

Per-subagent briefing must include:
- The stage's task text in full.
- Exact commands (no improvisation).
- The TDD characterization-test code.
- Acceptance criteria.
- Commit message template.
- Hard rules:
  - Use `cargo` for Rust stages, `yarn` for TS stages — never substitute.
  - Don't weaken tests to mask failures. Investigate root cause OR report BLOCKED.
  - Avoid rabbit holes. Reading library source for the third time → STOP and BLOCKED.
  - Minimal source changes — only what the upgrade *forces*.
  - No `--amend`, no `--no-verify`.

If a stage stalls, give the user the choice: defer (revert + memory), escalate, or hands-on debug.

## Rollback strategy

One stage = one commit. `git revert <SHA>` to back out a stage. If later stages depend on the reverted stage, they may need to revert too. The hold on `reqwest` means we can't accidentally cascade an unrelated revert through reqwest's transitive changes.

## Out of scope

- Switching package managers (yarn → pnpm, cargo → ...).
- Refactors unrelated to the upgrade itself.
- Feature work.
- Using new framework features just because the version supports them — the goal is to be *on* the new version, not to rewrite to its idioms.
- Fixing the preexisting `App.test.tsx` flake. We'll work around it (retry on cold run) rather than fix it.
- Updating CI workflows or Dockerfile beyond what the upgrade strictly requires.

## Open risks

- **jsonwebtoken 10** is a security-sensitive upgrade — read the changelog carefully for any verification-behavior changes.
- **axum-extra 0.12** crosses two pre-1.0 minor versions; extractor APIs may have shifted.
- **storybook 10** likely requires significant `.storybook/main.ts` and addon config rewrites.
- **@apollo/client 4** has a major package-structure change (subpath imports like `@apollo/client/react` for hooks). The recent `useRefetchingMutation` helper added in the tidy pass uses `import { useMutation, MutationHookOptions, DocumentNode, OperationVariables } from '@apollo/client'` — that import will likely need to be split.
- **typescript 6** may surface new errors throughout the project; some may take real investigation. If too many, this stage gets DEFERRED rather than weakening tsconfig.
- **No backend integration tests cover the OIDC flow.** jsonwebtoken and axum-extra both touch `src/auth.rs`. The characterization test for each will exercise the specific call sites (jwks verification, cookie jar) directly.
- **`App.test.tsx` cold-run flake** may falsely fail a stage verification. Mitigation: re-run vitest a second time before declaring a stage red.

## Branch & commit summary template

Branch: `deps/2026-05-24`.
Commits land in this order: R-1, R-2, R-3, T-1, T-2, T-3, T-4, T-5, T-6, T-7. Plus the spec + plan commits themselves. Final state: 10 stage commits + 2 doc commits = 12 commits on `deps/2026-05-24`.
