#![allow(clippy::collapsible_if)]
use crate::api::AppError;
use crate::context::GraphQLContext;
use crate::svc::{UserImageSvc, UserSvc};

use anyhow::{Context, anyhow};
use axum::extract::{Multipart, Path};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Extension, Router};
use tracing::error;
use uuid::Uuid;

pub fn image_routes() -> Router {
    Router::new()
        .route("/upload/{user_uuid}", post(upload_user_image))
        .route("/user/{user_id}", get(get_user_image))
        .route("/{image_uuid}", get(get_image_by_uuid))
        .route("/user/{user_id}", delete(delete_image_by_user_id))
}

async fn delete_image_by_user_id(
    Extension(context): Extension<GraphQLContext>,
    Path(user_id): Path<i32>,
) -> Result<impl IntoResponse, AppError> {
    UserImageSvc::delete_by_user_id(&context, user_id).context("failed to delete image")?;

    Ok((
        StatusCode::OK,
        format!("Image deleted successfully for user {user_id}"),
    ))
}

// Image upload handler
async fn upload_user_image(
    Extension(context): Extension<GraphQLContext>,
    Path(user_uuid): Path<String>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    // Get the user to verify they exist
    let user = UserSvc::get(&context, &user_uuid).context("fetching user")?;

    while let Some(field) = multipart.next_field().await.context("reading multipart")? {
        if let Some(name) = field.name() {
            if name == "image" {
                let content_type = field.content_type().unwrap_or("image/jpeg").to_owned();

                // Validate content type
                if !content_type.starts_with("image/") {
                    return Err(AppError(anyhow!("Only image files are allowed")));
                }

                let data = field.bytes().await.context("could not read image data")?;

                // Check file size (max 5MB)
                if data.len() > 5 * 1024 * 1024 {
                    return Err(AppError(anyhow!("Image too large (max 5MB)")));
                }

                // Delete existing image for this user
                let user_id = user.id.context("user id missing")?;
                let delete_response = UserImageSvc::delete_by_user_id(&context, user_id);
                if let Err(e) = delete_response {
                    error!("Failed to delete existing image: {}", e);
                }

                // Create new image
                let image_input = crate::models::UserImageInput {
                    user_id,
                    image_data: data.to_vec(),
                    content_type,
                    file_size: data.len() as i32,
                };

                let user_image =
                    UserImageSvc::create(&context, image_input).context("saving image")?;

                // Update user's image_id reference
                UserImageSvc::update_user_image_reference(&context, user_id, Some(user_image.id))
                    .context("updating user image reference")?;

                return Ok((StatusCode::OK, "Image uploaded successfully"));
            }
        }
    }

    Err(AppError(anyhow!("No image field found in the upload")))
}

// Get user image handler
async fn get_user_image(
    Extension(context): Extension<GraphQLContext>,
    Path(user_id): Path<i32>,
) -> Result<Response, AppError> {
    let image = UserImageSvc::get_by_user_id(&context, user_id)
        .context("fetching user image")?
        .context("grabbing image")?;

    Ok(Response::builder()
        .header("Content-Type", image.content_type)
        .header("Content-Length", image.file_size.to_string())
        .header("Cache-Control", "public, max-age=86400")
        .body(image.image_data.into())
        .context("building response")?)
}

// Get image by UUID handler
async fn get_image_by_uuid(
    Extension(context): Extension<GraphQLContext>,
    Path(image_uuid): Path<Uuid>,
) -> Result<Response, AppError> {
    let image = UserImageSvc::get_by_uuid(&context, image_uuid)
        .context("fetching image by uuid")?
        .context("grabbing image")?;

    Ok(Response::builder()
        .header("Content-Type", image.content_type)
        .header("Content-Length", image.file_size.to_string())
        .header("Cache-Control", "public, max-age=86400")
        .body(image.image_data.into())
        .context("building response")?)
}
