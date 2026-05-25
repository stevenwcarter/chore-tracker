//! Characterization test for axum-extra APIs used in src/auth.rs and src/routes.rs.
//! Covers Cookie::build + CookieJar add/remove/get, the surface used in OIDC handlers.
//! Must pass on the current version (0.10), then still pass after upgrading to 0.12.

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

#[test]
fn cookie_jar_split_value_pattern() {
    // Mirrors the verify_oidc_state pattern: read a cookie, split on '|', remove from jar.
    let cookie = Cookie::build(("oidc_state", "state-abc|nonce-xyz"))
        .path("/")
        .build();
    let jar = CookieJar::new().add(cookie);

    let stored = jar
        .get("oidc_state")
        .map(|c| c.value().to_owned())
        .expect("oidc_state cookie present");
    let jar = jar.remove("oidc_state");
    let (state, nonce) = stored.split_once('|').expect("split on |");
    assert_eq!(state, "state-abc");
    assert_eq!(nonce, "nonce-xyz");
    assert!(jar.get("oidc_state").is_none());
}
