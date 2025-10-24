use axum::Json;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::{Router, http::StatusCode, routing::get};
use serde::Serialize;

use crate::context::GraphQLContext;

pub mod auth;
pub mod graphql;
pub mod images;

pub fn api_routes(_context: GraphQLContext) -> Router {
    Router::new().route("/test", get(test))
}

pub async fn test(_headers: HeaderMap) -> Result<impl IntoResponse, AppError> {
    Ok("test")
}

pub fn err_wrapper<T: Serialize>(result: anyhow::Result<T>) -> impl IntoResponse {
    Json(
        result
            .map_err(|err| (StatusCode::NOT_FOUND, err.to_string()))
            .unwrap(),
    )
}

// Make our own error that wraps `anyhow::Error`.
pub struct AppError(anyhow::Error);

// Tell axum how to convert `AppError` into a response.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Something went wrong: {:?}", self.0),
        )
            .into_response()
    }
}

// This enables using `?` on functions that return `Result<_, anyhow::Error>` to turn them into
// `Result<_, AppError>`. That way you don't need to do that manually.
impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}
