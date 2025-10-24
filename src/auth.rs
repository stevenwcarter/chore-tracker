use anyhow::{Context, Result};
use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect},
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{context::GraphQLContext, get_env, svc::AdminSvc};

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

#[derive(Debug, Clone)]
pub struct OidcConfig {
    pub client_id: String,
    pub client_secret: String,
    pub discovery_url: String,
    pub redirect_url: String,
    pub discovery_config: Option<OidcDiscoveryConfig>,
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
        }
    }

    pub async fn initialize(&mut self) -> Result<()> {
        let client = reqwest::Client::new();

        let response = client
            .get(&self.discovery_url)
            .send()
            .await
            .context("getting discovery URL")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to fetch OIDC discovery config: {}\n{:?}",
                response.status(),
                response
            ));
        }

        let config: OidcDiscoveryConfig = response.json().await?;
        self.discovery_config = Some(config);
        Ok(())
    }

    pub fn get_authorization_url(&self, state: &str) -> Result<String> {
        let config = self
            .discovery_config
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("OIDC not initialized - call initialize() first"))?;

        Ok(format!(
            "{}?client_id={}&redirect_uri={}&response_type=code&scope=openid email profile&state={}",
            config.authorization_endpoint,
            urlencoding::encode(&self.client_id),
            urlencoding::encode(&self.redirect_url),
            urlencoding::encode(state)
        ))
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
) -> impl IntoResponse {
    let state = Uuid::new_v4().to_string();

    match oidc_config.get_authorization_url(&state) {
        Ok(auth_url) => {
            // In a real implementation, you'd store the state in a session/cache to verify on callback
            // For now, we'll redirect directly to the OIDC provider
            Redirect::to(&auth_url).into_response()
        }
        Err(_) => {
            // OIDC config not initialized or other error
            Redirect::to("/?error=oidc_config_error").into_response()
        }
    }
}

pub async fn callback_handler(
    State((oidc_config, context)): State<(OidcConfig, GraphQLContext)>,
    Query(params): Query<AuthCallback>,
    jar: CookieJar,
) -> impl IntoResponse {
    println!(
        "OIDC Callback received - code: {}, state: {}",
        params.code, params.state
    );

    // Exchange authorization code for access token
    match oidc_config.exchange_code_for_token(&params.code).await {
        Ok(token) => {
            println!(
                "Token exchange successful - access_token length: {}",
                token.access_token.len()
            );

            // Get user info from the OIDC provider
            match oidc_config.get_user_info(&token.access_token).await {
                Ok(user_info) => {
                    println!(
                        "User info retrieved - sub: {}, email: {:?}",
                        user_info.sub, user_info.email
                    );

                    // Get or create admin user automatically since OIDC access is restricted
                    let name = user_info
                        .name
                        .as_deref()
                        .or(user_info.preferred_username.as_deref())
                        .unwrap_or("Admin User");
                    let email = user_info.email.as_deref().unwrap_or("");

                    match AdminSvc::get_or_create_by_oidc(&context, &user_info.sub, name, email) {
                        Ok(admin) => {
                            println!("Admin authenticated: {}", admin.uuid);
                            // Create admin session
                            let session_cookie =
                                Cookie::build(("admin_session", admin.uuid.clone()))
                                    .path("/")
                                    .http_only(true)
                                    .secure(false) // Set to true in production with HTTPS
                                    .build();

                            let jar = jar.add(session_cookie);
                            (jar, Redirect::to("/admin")).into_response()
                        }
                        Err(e) => {
                            println!("Failed to get or create admin - error: {}", e);
                            Redirect::to("/?error=admin_creation_failed").into_response()
                        }
                    }
                }
                Err(e) => {
                    println!("UserInfo request failed: {}", e);
                    Redirect::to("/?error=userinfo_failed").into_response()
                }
            }
        }
        Err(e) => {
            println!("Token exchange failed: {}", e);
            Redirect::to("/?error=token_exchange_failed").into_response()
        }
    }
}

pub async fn logout_handler(jar: CookieJar) -> impl IntoResponse {
    let jar = jar.remove("admin_session");
    (jar, Redirect::to("/"))
}

pub async fn me_handler(
    State((_oidc_config, context)): State<(OidcConfig, GraphQLContext)>,
    jar: CookieJar,
) -> axum::response::Response {
    match check_admin_session(State(context), jar).await {
        Ok(admin) => axum::Json(admin).into_response(),
        Err(_) => axum::http::StatusCode::UNAUTHORIZED.into_response(),
    }
}

pub async fn check_admin_session(
    State(context): State<GraphQLContext>,
    jar: CookieJar,
) -> Result<crate::models::Admin> {
    let session_cookie = jar
        .get("admin_session")
        .ok_or_else(|| anyhow::anyhow!("No session found"))?;

    let admin_uuid = session_cookie.value();
    AdminSvc::get(&context, admin_uuid)
}
