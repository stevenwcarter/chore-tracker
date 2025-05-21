use crate::auth::OidcConfig;
use crate::context::GraphQLContext;
use crate::graphql::create_schema;
use crate::api::{auth, graphql, images};

use axum::extract::Request;
use axum::http::{HeaderValue, StatusCode, Uri};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Extension, Router};
use reqwest::{Method, header};
use rust_embed::RustEmbed;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};

#[derive(RustEmbed, Clone)]
#[folder = "site/build/"]
struct Assets;

pub struct StaticFile<T>(pub T);

impl<T> IntoResponse for StaticFile<T>
where
    T: Into<String>,
{
    fn into_response(self) -> Response {
        let path = self.0.into();

        match Assets::get(path.as_str()) {
            Some(content) => {
                let mime = mime_guess::from_path(path).first_or_octet_stream();
                ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
            }
            None => (StatusCode::NOT_FOUND, "404 Not Found").into_response(),
        }
    }
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let mut path = uri.path().trim_start_matches('/').to_owned();

    if path.starts_with("dist/") {
        path = path.replace("dist/", "");
    }

    StaticFile(path)
}

async fn index_handler() -> impl IntoResponse {
    static_handler("/index.html".parse::<Uri>().unwrap()).await
}

pub async fn app(context: GraphQLContext) -> Router {
    let qm_schema = create_schema();
    let mut oidc_config = OidcConfig::from_env();

    // Initialize OIDC discovery config
    if let Err(e) = oidc_config.initialize().await {
        log::warn!("Failed to initialize OIDC config: {}", e);
    }

    let cors = CorsLayer::new()
        .allow_methods([Method::GET])
        .allow_headers(Any)
        .allow_methods(Any)
        .allow_origin(Any);

    let middleware = ServiceBuilder::new()
        .layer(cors)
        .layer(CompressionLayer::new());

    // Create modular routes
    let graphql_routes = graphql::graphql_routes()
        .layer(Extension(context.clone()))
        .layer(Extension(Arc::new(qm_schema)));

    let auth_routes = auth::auth_routes(oidc_config.clone(), context.clone());

    let image_routes = images::image_routes()
        .layer(Extension(context.clone()));

    Router::new()
        .route("/assets/{*uri}", get(static_handler))
        .layer(middleware::from_fn(set_static_cache_control))
        .nest("/graphql", graphql_routes)
        .nest("/auth", auth_routes)
        .nest("/images", image_routes)
        .route("/", get(index_handler))
        .fallback_service(get(index_handler))
        .layer(Extension(context.clone()))
        .layer(middleware)
}

async fn set_static_cache_control(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    response.headers_mut().insert(
        "cache-control",
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    response
}
