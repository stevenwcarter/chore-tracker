//! Characterization test for jsonwebtoken APIs used in
//! src/auth.rs::OidcConfig::verify_id_token.
//! Must pass on the current version (9.x), then still pass after upgrading to 10.x.

use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, decode_header, encode,
    jwk::JwkSet,
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

    let token_data =
        decode::<TestClaims>(&token, &DecodingKey::from_secret(secret), &validation).expect("decode");
    assert_eq!(token_data.claims.sub, "user-123");
    assert_eq!(token_data.claims.nonce.as_deref(), Some("test-nonce"));
}

#[test]
fn jwk_set_parses_from_json() {
    // Mirrors the JwkSet parsing inside verify_id_token (we don't construct a full
    // RSA JWK here — just exercise the parsing + find-by-kid surface).
    let jwks_json = r#"{"keys":[{"kty":"RSA","use":"sig","alg":"RS256","kid":"test-kid","n":"v_test","e":"AQAB"}]}"#;
    let jwks: JwkSet = serde_json::from_str(jwks_json).expect("parse JwkSet");
    assert!(jwks.find("test-kid").is_some());
}
