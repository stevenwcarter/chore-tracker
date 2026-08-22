use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;

pub mod auth;
pub mod graphql;
pub mod images;

/// Axum-friendly error wrapper around `anyhow::Error` that converts to an HTTP response,
/// mapping `Unauthorized` messages to 401 and everything else to 404.
pub struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = if self.0.to_string().starts_with("Unauthorized") {
            StatusCode::UNAUTHORIZED
        } else {
            StatusCode::NOT_FOUND
        };
        (status, format!("Error: {}", self.0)).into_response()
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
