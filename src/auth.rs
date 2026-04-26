use anyhow::{Context, Result};
use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect},
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::{context::GraphQLContext, get_env, models::Admin, svc::AdminSvc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub iss: String,
    pub aud: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Clone)]
pub struct OidcConfig {
    pub client_id: String,
    pub client_secret: String,
    pub discovery_url: String,
    pub redirect_url: String,
    pub discovery_config: Option<OidcDiscoveryConfig>,
    pub jwks: Option<jsonwebtoken::jwk::JwkSet>,
}

impl std::fmt::Debug for OidcConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OidcConfig")
            .field("client_id", &self.client_id)
            .field("client_secret", &"[REDACTED]")
            .field("discovery_url", &self.discovery_url)
            .field("redirect_url", &self.redirect_url)
            .field("discovery_config", &self.discovery_config)
            .finish()
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct OidcDiscoveryConfig {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub userinfo_endpoint: String,
    pub end_session_endpoint: Option<String>,
    pub jwks_uri: String,
}

impl OidcConfig {
    pub fn from_env() -> Self {
        Self {
            client_id: get_env("OIDC_CLIENT_ID", ""),
            client_secret: get_env("OIDC_CLIENT_SECRET", ""),
            discovery_url: get_env("OIDC_DISCOVERY_URL", ""),
            redirect_url: get_env("OIDC_REDIRECT_URL", "http://localhost:7007/auth/callback"),
            discovery_config: None,
            jwks: None,
        }
    }

    pub async fn initialize(&mut self) -> Result<()> {
        let client = reqwest::Client::new();

        let response = client
            .get(&self.discovery_url)
            .send()
            .await
            .context("fetching oidc discovery config");

        let response = match response {
            Ok(resp) => resp,
            Err(e) => {
                error!("Failed to fetch OIDC discovery config: {:?}", e);
                for cause in e.chain().skip(1) {
                    error!("Caused by: {}", cause);
                }
                return Err(anyhow::anyhow!("Failed to fetch OIDC discovery config: {:?}", e));
            }
        };

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to fetch OIDC discovery config: {}\n{:?}",
                response.status(),
                response
            ));
        }

        let config: OidcDiscoveryConfig = response
            .json()
            .await
            .context("parsing oidc discovery config as json")?;

        // Fetch JWKS from the discovered jwks_uri
        let jwks: jsonwebtoken::jwk::JwkSet = client
            .get(&config.jwks_uri)
            .send()
            .await
            .context("fetching JWKS")?
            .json()
            .await
            .context("parsing JWKS")?;

        self.discovery_config = Some(config);
        self.jwks = Some(jwks);
        Ok(())
    }

    pub fn get_authorization_url(&self, state: &str, nonce: &str) -> Result<String> {
        let config = self
            .discovery_config
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("OIDC not initialized - call initialize() first"))?;

        Ok(format!(
            "{}?client_id={}&redirect_uri={}&response_type=code&scope=openid email profile&state={}&nonce={}",
            config.authorization_endpoint,
            urlencoding::encode(&self.client_id),
            urlencoding::encode(&self.redirect_url),
            urlencoding::encode(state),
            urlencoding::encode(nonce),
        ))
    }

    pub async fn verify_id_token(&self, id_token: &str, expected_nonce: &str) -> Result<()> {
        use jsonwebtoken::{decode, decode_header, DecodingKey, Validation};

        let header = decode_header(id_token).context("decoding id_token header")?;
        let kid = header.kid.as_deref().unwrap_or("");

        let jwks = self.jwks.as_ref().ok_or_else(|| anyhow::anyhow!("JWKS not initialised"))?;
        let jwk = jwks
            .find(kid)
            .ok_or_else(|| anyhow::anyhow!("No JWK found for kid={}", kid))?;

        let decoding_key = DecodingKey::from_jwk(jwk).context("building decoding key from JWK")?;

        let config = self
            .discovery_config
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("OIDC not initialised"))?;

        let mut validation = Validation::new(header.alg);
        validation.set_issuer(&[&config.issuer]);
        validation.set_audience(&[&self.client_id]);

        #[derive(serde::Deserialize)]
        struct IdTokenClaims {
            nonce: Option<String>,
        }

        let token_data = decode::<IdTokenClaims>(id_token, &decoding_key, &validation)
            .context("verifying id_token signature and claims")?;

        match token_data.claims.nonce.as_deref() {
            Some(n) if n == expected_nonce => Ok(()),
            Some(_) => Err(anyhow::anyhow!("id_token nonce mismatch")),
            None => Err(anyhow::anyhow!("id_token missing nonce claim")),
        }
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> Result<TokenResponse> {
        let config = self
            .discovery_config
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("OIDC not initialized - call initialize() first"))?;

        let client = reqwest::Client::new();

        let params = [
            ("grant_type", "authorization_code"),
            ("code", code),
            ("client_id", &self.client_id),
            ("client_secret", &self.client_secret),
            ("redirect_uri", &self.redirect_url),
        ];

        let response = client
            .post(&config.token_endpoint)
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Token exchange failed: {} - {}",
                status,
                text
            ));
        }

        let token: TokenResponse = response.json().await?;
        Ok(token)
    }

    pub async fn get_user_info(&self, access_token: &str) -> Result<UserInfo> {
        let config = self
            .discovery_config
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("OIDC not initialized - call initialize() first"))?;

        let client = reqwest::Client::new();

        let response = client
            .get(&config.userinfo_endpoint)
            .bearer_auth(access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "UserInfo request failed: {} - {}",
                status,
                text
            ));
        }

        let user_info: UserInfo = response.json().await?;
        Ok(user_info)
    }
}

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub id_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UserInfo {
    pub sub: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub preferred_username: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuthCallback {
    code: String,
    state: String,
}

// OIDC handlers with real implementation
pub async fn login_handler(
    State((oidc_config, _context)): State<(OidcConfig, GraphQLContext)>,
    jar: CookieJar,
) -> impl IntoResponse {
    let state = Uuid::new_v4().to_string();
    let nonce = Uuid::new_v4().to_string();
    let state_value = format!("{}|{}", state, nonce);

    oidc_config.get_authorization_url(&state, &nonce).map_or_else(
        |_| Redirect::to("/?error=oidc_config_error").into_response(),
        |auth_url| {
            let state_cookie = Cookie::build(("oidc_state", state_value))
                .path("/")
                .http_only(true)
                .secure(!cfg!(debug_assertions))
                .same_site(axum_extra::extract::cookie::SameSite::Lax)
                .build();
            (jar.add(state_cookie), Redirect::to(&auth_url)).into_response()
        },
    )
}

pub async fn callback_handler(
    State((oidc_config, context)): State<(OidcConfig, GraphQLContext)>,
    Query(params): Query<AuthCallback>,
    jar: CookieJar,
) -> impl IntoResponse {
    debug!("OIDC callback received");

    // Verify CSRF state matches what was set in login_handler
    let stored = match jar.get("oidc_state").map(|c| c.value().to_owned()) {
        Some(s) => s,
        None => return Redirect::to("/?error=missing_state").into_response(),
    };
    let jar = jar.remove("oidc_state");

    let (stored_state, stored_nonce) = match stored.split_once('|') {
        Some((s, n)) => (s.to_owned(), n.to_owned()),
        None => return Redirect::to("/?error=invalid_state").into_response(),
    };

    if stored_state != params.state {
        error!("OIDC state mismatch - possible CSRF attack");
        return (jar, Redirect::to("/?error=state_mismatch")).into_response();
    }

    // Exchange authorization code for access token
    match oidc_config.exchange_code_for_token(&params.code).await {
        Ok(token) => {
            debug!("Token exchange successful");

            // Verify id_token if present
            if let Some(ref id_token_str) = token.id_token {
                match oidc_config.verify_id_token(id_token_str, &stored_nonce).await {
                    Ok(()) => debug!("id_token verified successfully"),
                    Err(e) => {
                        error!("id_token verification failed: {}", e);
                        return Redirect::to("/?error=token_verification_failed").into_response();
                    }
                }
            }

            // Get user info from the OIDC provider
            match oidc_config.get_user_info(&token.access_token).await {
                Ok(user_info) => {
                    debug!("User info retrieved");

                    // Get or create admin user automatically since OIDC access is restricted
                    let name = user_info
                        .name
                        .as_deref()
                        .or(user_info.preferred_username.as_deref())
                        .unwrap_or("Admin User");
                    let email = user_info.email.as_deref().unwrap_or("");

                    match AdminSvc::get_or_create_by_oidc(&context, &user_info.sub, name, email) {
                        Ok(admin) => {
                            info!("Admin authenticated: {}", admin.uuid);
                            // Create opaque session token in DB
                            let admin_id = match admin.id {
                                Some(id) => id,
                                None => {
                                    error!("Admin has no id after get_or_create");
                                    return Redirect::to("/?error=session_creation_failed").into_response();
                                }
                            };
                            let token = match AdminSvc::create_session(&context, admin_id) {
                                Ok(t) => t,
                                Err(e) => {
                                    error!("Failed to create admin session: {}", e);
                                    return Redirect::to("/?error=session_creation_failed").into_response();
                                }
                            };
                            let session_cookie = Cookie::build(("admin_session", token))
                                .path("/")
                                .http_only(true)
                                .secure(!cfg!(debug_assertions))
                                .same_site(axum_extra::extract::cookie::SameSite::Lax)
                                .max_age(time::Duration::days(7))
                                .build();

                            let jar = jar.add(session_cookie);
                            (jar, Redirect::to("/admin")).into_response()
                        }
                        Err(e) => {
                            error!("Failed to get or create admin: {}", e);
                            Redirect::to("/?error=admin_creation_failed").into_response()
                        }
                    }
                }
                Err(e) => {
                    error!("UserInfo request failed: {}", e);
                    Redirect::to("/?error=userinfo_failed").into_response()
                }
            }
        }
        Err(e) => {
            error!("Token exchange failed: {}", e);
            Redirect::to("/?error=token_exchange_failed").into_response()
        }
    }
}

pub async fn logout_handler(
    State((_oidc_config, context)): State<(OidcConfig, GraphQLContext)>,
    jar: CookieJar,
) -> impl IntoResponse {
    if let Some(cookie) = jar.get("admin_session") {
        let token = cookie.value().to_owned();
        if let Err(e) = AdminSvc::delete_session(&context, &token) {
            error!("Failed to delete session on logout: {}", e);
        }
    }
    let jar = jar.remove("admin_session");
    (jar, Redirect::to("/"))
}

pub async fn me_handler(
    State((_oidc_config, context)): State<(OidcConfig, GraphQLContext)>,
    jar: CookieJar,
) -> axum::response::Response {
    (check_admin_session(State(context), jar).await).map_or_else(
        |_| axum::http::StatusCode::UNAUTHORIZED.into_response(),
        |admin| axum::Json(admin).into_response(),
    )
}

pub async fn check_admin_session(
    State(context): State<GraphQLContext>,
    jar: CookieJar,
) -> Result<Admin> {
    let session_cookie = jar
        .get("admin_session")
        .ok_or_else(|| anyhow::anyhow!("No session found"))?;

    let token = session_cookie.value();
    AdminSvc::get_session(&context, token)?
        .ok_or_else(|| anyhow::anyhow!("Session not found or expired"))
}
