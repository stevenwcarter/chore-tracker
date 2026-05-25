# 2026-05-24 deps upgrade — implementation plan

Spec: `docs/superpowers/specs/2026-05-24-deps-upgrade-design.md`. Branch: `deps/2026-05-24`.

Each task below is self-contained: a subagent reading only that task should be able to complete it. Tasks run **sequentially**. After each stage commit, the coordinator reviews the diff and verification output before dispatching the next.

---

## Task R-1: Rust within-range patch/minor batch

**Working dir:** `/home/steve/src/chore-tracker` (repo root).

**Goal:** bump every Rust dep listed in spec §"Within-range bumps (Stage R-1 batch)" to its latest in-range version. EXCLUDE `reqwest` (held).

**Commands:**
```bash
cargo update \
  --package anyhow \
  --package axum \
  --package chrono \
  --package diesel \
  --package diesel_migrations \
  --package juniper \
  --package rust-embed \
  --package serde_json \
  --package tokio \
  --package tower \
  --package tower-http \
  --package tracing \
  --package tracing-subscriber \
  --package uuid
```

**Migration:** none expected (within-range bumps are SemVer-compatible).

**Verification:**
```bash
cargo build
cargo clippy --all-targets
cargo test
```

All three must exit 0. clippy may emit the same ~10 preexisting warnings; reject new ones.

**Commit:**
```
chore(deps): stage R-1 - rust within-range patch/minor batch

- anyhow         1.0.100 -> 1.0.102
- axum           0.8.6   -> 0.8.9
- chrono         0.4.42  -> 0.4.44
- diesel         2.3.3   -> 2.3.9
- diesel_migrations  2.3.0 -> 2.3.2
- juniper        0.17.0  -> 0.17.1
- rust-embed     8.8.0   -> 8.11.0
- serde_json     1.0.145 -> 1.0.150
- tokio          1.48.0  -> 1.52.3
- tower          0.5.2   -> 0.5.3
- tower-http     0.6.6   -> 0.6.11
- tracing        0.1.41  -> 0.1.44
- tracing-subscriber 0.3.20 -> 0.3.23
- uuid           1.18.1  -> 1.23.1

reqwest held at 0.12.24 per user request.
```

**Rules:** see spec §"Implementation discipline".

---

## Task R-2: jsonwebtoken 9 → 10

**Working dir:** `/home/steve/src/chore-tracker`.

**Goal:** upgrade `jsonwebtoken` to the latest 10.x.

### TDD characterization test (BEFORE the upgrade)

Create `tests/upgrade_jsonwebtoken.rs` with:

```rust
//! Characterization test for jsonwebtoken APIs used in src/auth.rs::OidcConfig::verify_id_token.
//! Must pass on the current version, then still pass after upgrading to 10.x.

use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, decode_header, encode,
    jwk::{AlgorithmParameters, CommonParameters, Jwk, JwkSet, KeyAlgorithm, PublicKeyUse, RSAKeyParameters, RSAKeyType},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct TestClaims {
    sub: String,
    iss: String,
    aud: String,
    exp: usize,
    nonce: Option<String>,
}

#[test]
fn encode_decode_roundtrip_hs256() {
    // Mirrors the validation shape inside OidcConfig::verify_id_token:
    // build a Validation, set issuer + audience, then decode.
    let claims = TestClaims {
        sub: "user-123".to_owned(),
        iss: "https://issuer.example.com".to_owned(),
        aud: "client-abc".to_owned(),
        exp: (chrono::Utc::now().timestamp() as usize) + 3600,
        nonce: Some("test-nonce".to_owned()),
    };
    let secret = b"test-secret-key-that-is-long-enough-for-hs256-please";
    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret),
    )
    .expect("encode");

    let header = decode_header(&token).expect("decode_header");
    assert_eq!(header.alg, Algorithm::HS256);

    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&["https://issuer.example.com"]);
    validation.set_audience(&["client-abc"]);

    let token_data = decode::<TestClaims>(
        &token,
        &DecodingKey::from_secret(secret),
        &validation,
    )
    .expect("decode");
    assert_eq!(token_data.claims.sub, "user-123");
    assert_eq!(token_data.claims.nonce.as_deref(), Some("test-nonce"));
}

#[test]
fn jwk_parameters_construct_decoding_key() {
    // Mirrors DecodingKey::from_jwk usage in verify_id_token.
    // We can't easily build a working JWK here without RSA keys, so just exercise
    // JwkSet parsing from JSON — that's the shape verify_id_token loads.
    let jwks_json = r#"{"keys":[{"kty":"RSA","use":"sig","alg":"RS256","kid":"test-kid","n":"v_test","e":"AQAB"}]}"#;
    let jwks: JwkSet = serde_json::from_str(jwks_json).expect("parse JwkSet");
    assert!(jwks.find("test-kid").is_some());
}
```

Run the test against the current version: `cargo test --test upgrade_jsonwebtoken`. Both tests must pass.

### Apply the upgrade

Edit `Cargo.toml`: change `jsonwebtoken = "9"` to `jsonwebtoken = "10"`.

```bash
cargo update -p jsonwebtoken
```

### Migration

Likely-affected code: `src/auth.rs::OidcConfig::verify_id_token` (uses `decode`, `decode_header`, `DecodingKey::from_jwk`, `Validation::new`, `Validation::set_issuer`, `Validation::set_audience`).

Review jsonwebtoken 10 release notes; common breaking changes in this kind of crate are:
- `Validation::set_issuer` / `set_audience` may have changed slice types.
- `DecodingKey::from_jwk` may have changed error type.
- `Algorithm` enum variants may have shifted.

Fix any compile errors with minimal, behavior-preserving edits.

### Verification

```bash
cargo build
cargo clippy --all-targets
cargo test
cargo test --test upgrade_jsonwebtoken
```

All must exit 0. The characterization test from step 1 must still pass.

### Commit

```
chore(deps): stage R-2 - jsonwebtoken 9 -> 10

- jsonwebtoken  9.3.1 -> 10.4.0

Migration: <list any API changes you had to apply, with file:line>.
Characterization test at tests/upgrade_jsonwebtoken.rs covers the
verify_id_token call surface.
```

If migration was non-trivial, list each edit in the commit body.

**Rules:** see spec §"Implementation discipline".

---

## Task R-3: axum-extra 0.10 → 0.12

**Working dir:** `/home/steve/src/chore-tracker`.

**Goal:** upgrade `axum-extra` to the latest 0.12.x.

### TDD characterization test (BEFORE the upgrade)

Create `tests/upgrade_axum_extra.rs`:

```rust
//! Characterization test for axum-extra APIs used in src/auth.rs and src/routes.rs:
//! CookieJar add/remove/get and the Cookie::build pattern with SameSite/Duration.
//! Must pass on the current version, then still pass after upgrading to 0.12.x.

use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};

#[test]
fn cookie_builder_and_jar_roundtrip() {
    let cookie = Cookie::build(("test_name", "test_value"))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::days(7))
        .build();

    let jar = CookieJar::new();
    let jar = jar.add(cookie);
    let retrieved = jar.get("test_name").expect("cookie should be present");
    assert_eq!(retrieved.value(), "test_value");

    let jar = jar.remove("test_name");
    assert!(jar.get("test_name").is_none(), "cookie should be removed");
}
```

Run: `cargo test --test upgrade_axum_extra`. Must pass on current version.

### Apply the upgrade

Edit `Cargo.toml`: change `axum-extra = { version = "0.10", ... }` to `axum-extra = { version = "0.12", ... }`. Keep the feature list (`"cookie"`, `"json-deserializer"`, `"query"`).

```bash
cargo update -p axum-extra
```

### Migration

Likely-affected code:
- `src/auth.rs`: `CookieJar` extraction, `Cookie::build`, `jar.add/remove/get`, `Query<AuthCallback>`.
- `src/routes.rs`: any axum-extra imports.

Review axum-extra 0.11 + 0.12 release notes for extractor or builder changes.

### Verification

```bash
cargo build
cargo clippy --all-targets
cargo test
cargo test --test upgrade_axum_extra
```

### Commit

```
chore(deps): stage R-3 - axum-extra 0.10 -> 0.12

- axum-extra  0.10.3 -> 0.12.6

Migration: <list any API changes>.
Characterization test at tests/upgrade_axum_extra.rs covers the
Cookie::build + CookieJar add/remove/get surface used in auth.rs.
```

**Rules:** see spec §"Implementation discipline".

---

## Task T-1: TS within-range patch/minor batch

**Working dir:** `/home/steve/src/chore-tracker/site`.

**Goal:** bump every TS dep listed in spec §"Within-range (Stage T-1 batch)" to its latest in-range version.

**Commands:**
```bash
cd /home/steve/src/chore-tracker/site

yarn upgrade \
  @apollo/client \
  @fortawesome/react-fontawesome \
  @storybook/addon-links \
  @storybook/react \
  @storybook/react-vite \
  @tailwindcss/vite \
  @types/node \
  @types/react \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  @vitejs/plugin-react \
  @vitest/coverage-v8 \
  autoprefixer \
  eslint \
  eslint-plugin-promise \
  eslint-plugin-react-hooks \
  globals \
  graphql \
  prettier \
  react \
  react-dom \
  react-router \
  react-router-dom \
  react-toastify \
  storybook \
  stylelint \
  tailwindcss \
  typescript-eslint \
  uuid \
  vite \
  vite-plugin-compression2 \
  vitest
```

(Bare `yarn upgrade` — within current ranges. Does NOT cross majors.)

Then check for any missed within-range bumps:
```bash
yarn outdated
```

If anything still shows yellow/green that isn't in our hold list, bump it explicitly.

**Verification:**
```bash
yarn lint
yarn build
yarn test --run      # if flaky on cold run, re-run once
```

**Commit:**
```
chore(deps): stage T-1 - ts within-range patch/minor batch

<paste yarn outdated diff or list each package's old -> new version>
```

**Rules:** see spec §"Implementation discipline".

---

## Task T-2: typescript 5 → 6

**Working dir:** `/home/steve/src/chore-tracker/site`.

### TDD characterization test (BEFORE the upgrade)

Create `src/upgrade-tests/typescript-surface.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

// Characterization: verify the TS features in active use across this codebase still
// compile cleanly at runtime (these tests don't add new compile-time coverage; the
// real check is `tsc --noEmit` via `yarn build`).
describe('TypeScript surface used in chore-tracker site', () => {
  it('optional chaining and nullish coalescing work', () => {
    const obj: { a?: { b?: number } } = { a: {} };
    expect(obj.a?.b ?? 0).toBe(0);
  });

  it('discriminated unions narrow correctly', () => {
    type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };
    const s: Shape = { kind: 'circle', r: 5 };
    const area = s.kind === 'circle' ? Math.PI * s.r * s.r : s.side * s.side;
    expect(area).toBeCloseTo(Math.PI * 25);
  });
});
```

Run: `yarn test --run src/upgrade-tests/typescript-surface.test.ts`. Must pass.

### Apply the upgrade

```bash
yarn upgrade typescript --latest
```

### Migration

Likely sources of new type errors: `useRefetchingMutation` generics (it uses `TData = any` which may now require explicit `unknown`), Apollo client types, anything using `noUncheckedIndexedAccess` if turned on.

Run `yarn build` and fix every type error with **minimal** changes. If a change requires more than 5 source files, STOP and report BLOCKED to the coordinator.

### Verification

```bash
yarn lint
yarn build
yarn test --run
yarn test --run src/upgrade-tests/typescript-surface.test.ts
```

### Commit

```
chore(deps): stage T-2 - typescript 5 -> 6

- typescript  5.9.3 -> 6.0.3

Migration: <list type-error fixes with file:line>.
Characterization test at src/upgrade-tests/typescript-surface.test.ts.
```

---

## Task T-3: jsdom 28 → 29

**Working dir:** `/home/steve/src/chore-tracker/site`.

### TDD characterization test

The existing `App.test.tsx` already exercises jsdom (renders a React component, queries the DOM). That serves as characterization. Confirm it passes on current jsdom before upgrading.

```bash
yarn test --run src/App.test.tsx
```

(May need to re-run on cold-run flake.)

### Apply the upgrade

```bash
yarn upgrade jsdom --latest
```

### Migration

jsdom 29 may change Node/global behaviors. Check `site/setupVitest.ts` for any jsdom-specific setup.

### Verification

```bash
yarn lint
yarn build
yarn test --run
```

### Commit

```
chore(deps): stage T-3 - jsdom 28 -> 29

- jsdom  28.1.0 -> 29.1.1
```

---

## Task T-4: Vite family (vite 7→8, @vitejs/plugin-react 5→6, vite-plugin-svgr 4→5)

**Working dir:** `/home/steve/src/chore-tracker/site`.

### TDD characterization test

Existing `yarn build` (vite build) and `yarn test --run` (vitest, which uses vite for module resolution) serve as characterization. Confirm both pass before upgrading.

### Apply the upgrade

```bash
yarn upgrade vite @vitejs/plugin-react vite-plugin-svgr --latest
```

### Migration

Review `vite.config.ts`. Likely changes:
- `defineConfig({ plugins: [...] })` plugin API may have changed.
- `vite-plugin-svgr` 4→5 may change the import shape (default vs named export, options object).

### Verification

```bash
yarn lint
yarn build
yarn test --run
yarn dev &
sleep 3
curl -fsS http://localhost:5173/ > /dev/null && echo "dev OK"
kill %1
wait %1 2>/dev/null
```

### Commit

```
chore(deps): stage T-4 - vite ecosystem family

- vite                  7.3.3 -> 8.x
- @vitejs/plugin-react  5.x   -> 6.0.2
- vite-plugin-svgr      4.5.0 -> 5.2.0

Migration: <list vite.config.ts edits if any>.
```

---

## Task T-5: Storybook family (storybook + addons + chromatic + eslint plugin)

**Working dir:** `/home/steve/src/chore-tracker/site`.

### TDD characterization test

Storybook is not exercised by vitest. The "test" is whether `yarn storybook` builds and serves successfully. Capture the current behavior by running:

```bash
yarn build-storybook 2>&1 | tail -5
```

Should exit 0. If it doesn't on the current version, that's a preexisting break — note it and proceed.

### Apply the upgrade

```bash
yarn upgrade \
  storybook \
  @storybook/addon-links \
  @storybook/react \
  @storybook/react-vite \
  eslint-plugin-storybook \
  @chromatic-com/storybook \
  --latest
```

### Migration

Storybook 8 → 10 is a TWO-major jump. Expect significant config changes:
- `.storybook/main.ts` likely needs rewrites for the new addon API.
- Story files (`*.stories.tsx`) usually survive but check CSF format.
- The `@storybook/addon-essentials` package was removed in 9 — replaced by individual addons. Check the addon array.
- `eslint-plugin-storybook` 0.x → 10.x may change rule names; update `eslint.config.js`.

This is the highest-risk TS stage. If migration grows beyond ~5 files, report BLOCKED and the coordinator will decide whether to defer.

### Verification

```bash
yarn lint
yarn build
yarn test --run
yarn build-storybook 2>&1 | tail -5    # must exit 0
yarn storybook &
sleep 8
curl -fsS http://localhost:6006/ > /dev/null && echo "storybook OK"
kill %1
wait %1 2>/dev/null
```

### Commit

```
chore(deps): stage T-5 - storybook 8 -> 10 family

- storybook                  8.6.18 -> 10.4.1
- @storybook/addon-links     8.6.18 -> 10.4.1
- @storybook/react           8.6.18 -> 10.4.1
- @storybook/react-vite      8.6.18 -> 10.4.1
- eslint-plugin-storybook    0.12.0 -> 10.4.1
- @chromatic-com/storybook   3.2.7  -> 5.2.1

Migration: <list config edits, removed addons, ESLint rule renames>.
```

---

## Task T-6: uuid 13 → 14

**Working dir:** `/home/steve/src/chore-tracker/site`.

### TDD characterization test

Create `src/upgrade-tests/uuid-surface.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

describe('uuid v4 surface used in chore-tracker site', () => {
  it('generates RFC 4122 v4 UUIDs', () => {
    const id = uuidv4();
    expect(uuidValidate(id)).toBe(true);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
```

Run: `yarn test --run src/upgrade-tests/uuid-surface.test.ts`. Must pass.

### Apply

```bash
yarn upgrade uuid --latest
```

### Migration

uuid 14 may be ESM-only or change import paths. Check imports in `site/src/` — likely `import { v4 } from 'uuid'`.

### Verification

```bash
yarn lint
yarn build
yarn test --run
```

### Commit

```
chore(deps): stage T-6 - uuid 13 -> 14

- uuid  13.0.0 -> 14.0.0
```

---

## Task T-7: @apollo/client 3 → 4

**Working dir:** `/home/steve/src/chore-tracker/site`.

### TDD characterization test

The existing `useBonusChores.test.tsx` exercises an Apollo `useQuery`/`useMutation` flow with a `MockedProvider`. That's the characterization. Confirm it passes on Apollo 3 before upgrading.

```bash
yarn test --run src/hooks/__tests__/useBonusChores.test.tsx
```

### Apply the upgrade

```bash
yarn upgrade @apollo/client --latest
```

### Migration

Apollo Client 4 changes (review their migration guide):
- React-specific exports moved to subpath `@apollo/client/react` (`useQuery`, `useMutation`, `useApolloClient`, `ApolloProvider`).
- `InMemoryCache` config may have changed.
- `MockedProvider` moved to `@apollo/client/testing/react`.
- `useMutation` return tuple may have a new shape.

Files to touch (likely):
- `site/src/App.tsx` (Apollo provider setup)
- Every file in `site/src/hooks/` (uses `useQuery`, `useMutation`)
- `site/src/hooks/useRefetchingMutation.ts` (helper around `useMutation`)
- `site/src/hooks/__tests__/useBonusChores.test.tsx` (uses `MockedProvider`)

This is the biggest-blast-radius stage. If migration grows beyond ~10 files, report BLOCKED.

### Verification

```bash
yarn lint
yarn build
yarn test --run
yarn dev &
sleep 3
curl -fsS http://localhost:5173/ > /dev/null && echo "dev OK"
kill %1
wait %1 2>/dev/null
```

### Commit

```
chore(deps): stage T-7 - @apollo/client 3 -> 4

- @apollo/client  3.14.1 -> 4.2.0

Migration: import paths split to @apollo/client/react,
useMutation tuple shape, useRefetchingMutation generics updated.
<list each file:line that changed>.
```

---

## Audit pass (final)

After T-7 commits, run final audits to confirm no surprise leftovers:

```bash
# Rust
cargo outdated --root-deps-only

# TS
cd site && yarn outdated
```

`reqwest` should still show as outdated (held by design). Everything else should be at latest. If anything else still shows outdated, evaluate: was it a transitive that just got nudged? A new release between spec write and execution? Decide whether to add a follow-up stage.

Report final state to the user.
