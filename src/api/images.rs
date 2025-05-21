use crate::context::GraphQLContext;
use crate::svc::{UserImageSvc, UserSvc};

use axum::extract::{Multipart, Path};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Extension, Router};

pub fn image_routes() -> Router {
    Router::new()
        .route("/upload/{user_uuid}", post(upload_user_image))
        .route("/user/{user_id}", get(get_user_image))
        .route("/id/{image_id}", get(get_image_by_id))
}

// Image upload handler
async fn upload_user_image(
    Extension(context): Extension<GraphQLContext>,
    Path(user_uuid): Path<String>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get the user to verify they exist
    let user = UserSvc::get(&context, &user_uuid)
        .map_err(|e| (StatusCode::NOT_FOUND, format!("User not found: {}", e)))?;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid multipart: {}", e)))?
    {
        if let Some(name) = field.name() {
            if name == "image" {
                let content_type = field.content_type().unwrap_or("image/jpeg").to_string();

                // Validate content type
                if !content_type.starts_with("image/") {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        "Only image files are allowed".to_string(),
                    ));
                }

                let data = field.bytes().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read image data: {}", e),
                    )
                })?;

                // Check file size (max 5MB)
                if data.len() > 5 * 1024 * 1024 {
                    return Err((
                        StatusCode::PAYLOAD_TOO_LARGE,
                        "Image too large (max 5MB)".to_string(),
                    ));
                }

                // Delete existing image for this user
                let user_id = user.id.ok_or((StatusCode::INTERNAL_SERVER_ERROR, "User ID not found".to_string()))?;
                let _ = UserImageSvc::delete_by_user_id(&context, user_id);

                // Create new image
                let image_input = crate::models::UserImageInput {
                    user_id,
                    image_data: data.to_vec(),
                    content_type,
                    file_size: data.len() as i32,
                };

                let user_image = UserImageSvc::create(&context, image_input).map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Failed to save image: {}", e),
                    )
                })?;

                // Update user's image_id reference
                UserImageSvc::update_user_image_reference(&context, user_id, Some(user_image.id))
                    .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Failed to update user reference: {}", e),
                    )
                })?;

                return Ok((StatusCode::OK, "Image uploaded successfully"));
            }
        }
    }

    Err((StatusCode::BAD_REQUEST, "No image field found".to_string()))
}

// Get user image handler
async fn get_user_image(
    Extension(context): Extension<GraphQLContext>,
    Path(user_id): Path<i32>,
) -> Result<Response, (StatusCode, String)> {
    let image = UserImageSvc::get_by_user_id(&context, user_id)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?
        .ok_or((StatusCode::NOT_FOUND, "Image not found".to_string()))?;

    Response::builder()
        .header("Content-Type", image.content_type)
        .header("Content-Length", image.file_size.to_string())
        .header("Cache-Control", "public, max-age=86400")
        .body(image.image_data.into())
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response".to_string(),
            )
        })
}

// Get image by ID handler
async fn get_image_by_id(
    Extension(context): Extension<GraphQLContext>,
    Path(image_id): Path<i32>,
) -> Result<Response, (StatusCode, String)> {
    let image = UserImageSvc::get_by_id(&context, image_id)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?
        .ok_or((StatusCode::NOT_FOUND, "Image not found".to_string()))?;

    Response::builder()
        .header("Content-Type", image.content_type)
        .header("Content-Length", image.file_size.to_string())
        .header("Cache-Control", "public, max-age=86400")
        .body(image.image_data.into())
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response".to_string(),
            )
        })
}