use crate::auth::{OidcConfig, callback_handler, login_handler, logout_handler, me_handler};
use crate::context::GraphQLContext;

use axum::routing::get;
use axum::Router;

pub fn auth_routes(oidc_config: OidcConfig, context: GraphQLContext) -> Router {
    Router::new()
        .route("/login", get(login_handler))
        .route("/callback", get(callback_handler))
        .route("/logout", get(logout_handler))
        .route("/me", get(me_handler))
        .with_state((oidc_config, context))
}