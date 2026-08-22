use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;

pub mod auth;
pub mod graphql;
pub mod images;

/// Marker error selecting `401 Unauthorized` for [`AppError`]'s response.
///
/// The status is chosen by downcasting to this type rather than by matching the
/// error's message, so wrapping it in `.context(..)` cannot silently change the
/// status code.
#[derive(Debug)]
pub struct Unauthorized;

impl std::fmt::Display for Unauthorized {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Unauthorized")
    }
}

impl std::error::Error for Unauthorized {}

/// Axum-friendly error wrapper around `anyhow::Error` that converts to an HTTP response,
/// mapping errors whose chain contains an [`Unauthorized`] marker to 401 and everything
/// else to 404.
pub struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = if self.0.chain().any(|e| e.is::<Unauthorized>()) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::anyhow;

    #[test]
    fn unauthorized_marker_maps_to_401() {
        let err = AppError(anyhow!(Unauthorized));
        assert_eq!(err.into_response().status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn unauthorized_survives_added_context() {
        // The bug this replaces: a prepended context string moved the message
        // off the "Unauthorized" prefix and silently downgraded 401 to 404.
        let err = AppError(
            anyhow::Error::from(Unauthorized).context("fetching user image"),
        );
        assert_eq!(err.into_response().status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn other_errors_map_to_404() {
        let err = AppError(anyhow!("something else went wrong"));
        assert_eq!(err.into_response().status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn a_message_merely_starting_with_unauthorized_is_not_special() {
        // Guards the reverse direction: status now comes from the type, not the text.
        let err = AppError(anyhow!("Unauthorized-looking message"));
        assert_eq!(err.into_response().status(), StatusCode::NOT_FOUND);
    }
}
