use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{NewUserImage, UserImage, UserImageInput},
    schema::user_images,
};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct UserImageSvc;

impl UserImageSvc {
    pub fn create(context: &GraphQLContext, input: UserImageInput) -> Result<UserImage> {
        let mut conn = get_conn(context);
        let new_user_image: NewUserImage = input.into();

        diesel::insert_into(user_images::table)
            .values(&new_user_image)
            .execute(&mut conn)
            .context("Failed to create user image")?;

        // Get the inserted record by querying the most recent one for this user
        user_images::table
            .filter(user_images::user_id.eq(new_user_image.user_id))
            .order(user_images::created_at.desc())
            .select(UserImage::as_select())
            .first::<UserImage>(&mut conn)
            .context("Failed to retrieve created user image")
    }

    pub fn get_by_user_id(context: &GraphQLContext, user_id: i32) -> Result<Option<UserImage>> {
        let mut conn = get_conn(context);
        
        user_images::table
            .filter(user_images::user_id.eq(user_id))
            .order(user_images::created_at.desc())
            .select(UserImage::as_select())
            .first::<UserImage>(&mut conn)
            .optional()
            .context("Failed to get user image")
    }

    pub fn get_by_id(context: &GraphQLContext, id: i32) -> Result<Option<UserImage>> {
        let mut conn = get_conn(context);
        
        user_images::table
            .find(id)
            .select(UserImage::as_select())
            .first::<UserImage>(&mut conn)
            .optional()
            .context("Failed to get user image by id")
    }

    pub fn delete_by_user_id(context: &GraphQLContext, user_id: i32) -> Result<usize> {
        let mut conn = get_conn(context);
        
        diesel::delete(user_images::table.filter(user_images::user_id.eq(user_id)))
            .execute(&mut conn)
            .context("Failed to delete user images")
    }

    pub fn update_user_image_reference(
        context: &GraphQLContext,
        user_id: i32,
        image_id: Option<i32>,
    ) -> Result<()> {
        use crate::schema::users;
        let mut conn = get_conn(context);
        
        diesel::update(users::table.filter(users::id.eq(user_id)))
            .set(users::image_id.eq(image_id))
            .execute(&mut conn)
            .context("Failed to update user image reference")?;
        
        Ok(())
    }
}