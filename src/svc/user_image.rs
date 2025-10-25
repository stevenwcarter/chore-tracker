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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        svc::UserSvc,
        test_helpers::test_db::{create_test_context, create_test_user},
    };
    use chrono::Utc;

    fn create_test_image_data() -> Vec<u8> {
        // Create some fake image data (simulating a small PNG)
        vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x01, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, // 1x1 pixel RGB
            0x00, 0x90, 0x77, 0x53, 0xDE, // CRC
        ]
    }

    fn create_test_user_image_input(user_id: i32) -> UserImageInput {
        UserImageInput {
            user_id,
            image_data: create_test_image_data(),
            content_type: "image/png".to_owned(),
            file_size: create_test_image_data().len() as i32,
        }
    }

    #[test]
    fn test_user_image_creation() {
        let context = create_test_context();
        let user = create_test_user(&context, "Test User");

        let image_input = create_test_user_image_input(user.id.unwrap());
        let created_image = UserImageSvc::create(&context, image_input.clone()).unwrap();

        assert_eq!(created_image.user_id, user.id.unwrap());
        assert_eq!(created_image.image_data, image_input.image_data);
        assert_eq!(created_image.content_type, image_input.content_type);
        assert_eq!(created_image.file_size, image_input.file_size);
        assert!(created_image.created_at <= Utc::now().naive_utc());
    }

    #[test]
    fn test_get_user_image_by_user_id() {
        let context = create_test_context();
        let user = create_test_user(&context, "Test User");

        // Initially no image
        let no_image = UserImageSvc::get_by_user_id(&context, user.id.unwrap()).unwrap();
        assert!(no_image.is_none());

        // Create an image
        let image_input = create_test_user_image_input(user.id.unwrap());
        let created_image = UserImageSvc::create(&context, image_input).unwrap();

        // Should now find the image
        let found_image = UserImageSvc::get_by_user_id(&context, user.id.unwrap()).unwrap();
        assert!(found_image.is_some());
        let found_image = found_image.unwrap();
        assert_eq!(found_image.id, created_image.id);
        assert_eq!(found_image.user_id, user.id.unwrap());
    }

    #[test]
    fn test_get_user_image_by_id() {
        let context = create_test_context();
        let user = create_test_user(&context, "Test User");

        let image_input = create_test_user_image_input(user.id.unwrap());
        let created_image = UserImageSvc::create(&context, image_input).unwrap();

        // Test get by existing ID
        let found_image = UserImageSvc::get_by_id(&context, created_image.id).unwrap();
        assert!(found_image.is_some());
        let found_image = found_image.unwrap();
        assert_eq!(found_image.id, created_image.id);

        // Test get by non-existent ID
        let not_found = UserImageSvc::get_by_id(&context, 99999).unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_multiple_images_for_user_returns_latest() {
        let context = create_test_context();
        let user = create_test_user(&context, "Test User");

        // Create first image
        let image_input1 = UserImageInput {
            user_id: user.id.unwrap(),
            image_data: vec![1, 2, 3, 4],
            content_type: "image/jpeg".to_owned(),
            file_size: 4,
        };
        let _first_image = UserImageSvc::create(&context, image_input1).unwrap();

        // Wait a moment to ensure different timestamps
        std::thread::sleep(std::time::Duration::from_millis(1));

        // Create second image
        let image_input2 = UserImageInput {
            user_id: user.id.unwrap(),
            image_data: vec![5, 6, 7, 8],
            content_type: "image/png".to_owned(),
            file_size: 4,
        };
        let second_image = UserImageSvc::create(&context, image_input2).unwrap();

        // get_by_user_id should return the latest (second) image
        let latest_image = UserImageSvc::get_by_user_id(&context, user.id.unwrap()).unwrap();
        assert!(latest_image.is_some());
        let latest_image = latest_image.unwrap();
        assert_eq!(latest_image.id, second_image.id);
        assert_eq!(latest_image.image_data, vec![5, 6, 7, 8]);
        assert_eq!(latest_image.content_type, "image/png");
    }

    #[test]
    fn test_delete_user_images() {
        let context = create_test_context();
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");

        // Create images for both users
        let image_input1 = create_test_user_image_input(user1.id.unwrap());
        let _image1 = UserImageSvc::create(&context, image_input1).unwrap();

        let image_input2 = create_test_user_image_input(user2.id.unwrap());
        let _image2 = UserImageSvc::create(&context, image_input2).unwrap();

        // Create second image for user1
        let image_input3 = UserImageInput {
            user_id: user1.id.unwrap(),
            image_data: vec![9, 10, 11, 12],
            content_type: "image/gif".to_owned(),
            file_size: 4,
        };
        let _image3 = UserImageSvc::create(&context, image_input3).unwrap();

        // Verify both users have images
        assert!(
            UserImageSvc::get_by_user_id(&context, user1.id.unwrap())
                .unwrap()
                .is_some()
        );
        assert!(
            UserImageSvc::get_by_user_id(&context, user2.id.unwrap())
                .unwrap()
                .is_some()
        );

        // Delete user1's images
        let deleted_count = UserImageSvc::delete_by_user_id(&context, user1.id.unwrap()).unwrap();
        assert_eq!(deleted_count, 2); // Should delete both images for user1

        // Verify user1 has no images, user2 still has images
        assert!(
            UserImageSvc::get_by_user_id(&context, user1.id.unwrap())
                .unwrap()
                .is_none()
        );
        assert!(
            UserImageSvc::get_by_user_id(&context, user2.id.unwrap())
                .unwrap()
                .is_some()
        );

        // Delete from user with no images should return 0
        let deleted_count2 = UserImageSvc::delete_by_user_id(&context, user1.id.unwrap()).unwrap();
        assert_eq!(deleted_count2, 0);
    }

    #[test]
    fn test_update_user_image_reference() {
        let context = create_test_context();
        let user = create_test_user(&context, "Test User");

        // Initially user should have no image_id reference
        let user_record = UserSvc::get_by_id(&context, user.id.unwrap()).unwrap();
        assert_eq!(user_record.image_id, None);

        // Create an image
        let image_input = create_test_user_image_input(user.id.unwrap());
        let created_image = UserImageSvc::create(&context, image_input).unwrap();

        // Update user to reference the image
        UserImageSvc::update_user_image_reference(
            &context,
            user.id.unwrap(),
            Some(created_image.id),
        )
        .unwrap();

        // Verify user now references the image
        let updated_user = UserSvc::get_by_id(&context, user.id.unwrap()).unwrap();
        assert_eq!(updated_user.image_id, Some(created_image.id));

        // Clear the image reference
        UserImageSvc::update_user_image_reference(&context, user.id.unwrap(), None).unwrap();

        // Verify reference is cleared
        let cleared_user = UserSvc::get_by_id(&context, user.id.unwrap()).unwrap();
        assert_eq!(cleared_user.image_id, None);
    }

    #[test]
    fn test_user_image_input_conversion() {
        let user_id = 123;
        let image_data = vec![1, 2, 3, 4, 5];
        let content_type = "image/jpeg".to_owned();
        let file_size = 5;

        let input = UserImageInput {
            user_id,
            image_data: image_data.clone(),
            content_type: content_type.clone(),
            file_size,
        };

        let new_user_image: NewUserImage = input.into();

        assert_eq!(new_user_image.user_id, user_id);
        assert_eq!(new_user_image.image_data, image_data);
        assert_eq!(new_user_image.content_type, content_type);
        assert_eq!(new_user_image.file_size, file_size);
        // created_at should be set to current time
        assert!(new_user_image.created_at <= Utc::now().naive_utc());
    }

    #[test]
    fn test_user_image_with_different_content_types() {
        let context = create_test_context();
        let user = create_test_user(&context, "Test User");

        let content_types = [
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "image/svg+xml",
        ];

        for (i, content_type) in content_types.iter().enumerate() {
            let image_input = UserImageInput {
                user_id: user.id.unwrap(),
                image_data: vec![i as u8; 10], // Different data for each
                content_type: content_type.to_string(),
                file_size: 10,
            };

            let created_image = UserImageSvc::create(&context, image_input).unwrap();
            assert_eq!(created_image.content_type, *content_type);
            assert_eq!(created_image.file_size, 10);
            assert_eq!(created_image.image_data.len(), 10);
        }
    }

    #[test]
    fn test_user_image_with_large_data() {
        let context = create_test_context();
        let user = create_test_user(&context, "Test User");

        // Create a larger image (1KB)
        let large_image_data: Vec<u8> = (0..1024).map(|i| (i % 256) as u8).collect();

        let image_input = UserImageInput {
            user_id: user.id.unwrap(),
            image_data: large_image_data.clone(),
            content_type: "image/png".to_owned(),
            file_size: large_image_data.len() as i32,
        };

        let created_image = UserImageSvc::create(&context, image_input).unwrap();
        assert_eq!(created_image.image_data, large_image_data);
        assert_eq!(created_image.file_size, 1024);
    }

    #[test]
    fn test_user_image_error_cases() {
        let context = create_test_context();

        // Test creating image for non-existent user
        let invalid_user_input = UserImageInput {
            user_id: 99999, // Non-existent user
            image_data: create_test_image_data(),
            content_type: "image/png".to_owned(),
            file_size: create_test_image_data().len() as i32,
        };

        let result = UserImageSvc::create(&context, invalid_user_input);
        assert!(result.is_err()); // Should fail due to foreign key constraint

        // Test get by non-existent user ID
        let no_image = UserImageSvc::get_by_user_id(&context, 99999).unwrap();
        assert!(no_image.is_none());

        // Test delete for non-existent user
        let deleted_count = UserImageSvc::delete_by_user_id(&context, 99999).unwrap();
        assert_eq!(deleted_count, 0); // Should not error, just return 0

        // Test update reference for non-existent user
        let result = UserImageSvc::update_user_image_reference(&context, 99999, Some(1));
        assert!(result.is_ok()); // Won't error even if user doesn't exist (diesel behavior)
    }

    #[test]
    fn test_user_image_workflow_integration() {
        let context = create_test_context();
        let user = create_test_user(&context, "Integration User");

        // Step 1: Create user image
        let image_input = create_test_user_image_input(user.id.unwrap());
        let created_image = UserImageSvc::create(&context, image_input).unwrap();

        // Step 2: Update user to reference the image
        UserImageSvc::update_user_image_reference(
            &context,
            user.id.unwrap(),
            Some(created_image.id),
        )
        .unwrap();

        // Step 3: Verify the complete workflow
        let updated_user = UserSvc::get_by_id(&context, user.id.unwrap()).unwrap();
        let user_image = UserImageSvc::get_by_user_id(&context, user.id.unwrap()).unwrap();

        assert_eq!(updated_user.image_id, Some(created_image.id));
        assert!(user_image.is_some());
        let user_image = user_image.unwrap();
        assert_eq!(user_image.id, created_image.id);

        // Step 4: Replace with new image
        let new_image_input = UserImageInput {
            user_id: user.id.unwrap(),
            image_data: vec![99, 100, 101],
            content_type: "image/jpeg".to_owned(),
            file_size: 3,
        };
        let new_image = UserImageSvc::create(&context, new_image_input).unwrap();

        UserImageSvc::update_user_image_reference(&context, user.id.unwrap(), Some(new_image.id))
            .unwrap();

        // Step 5: Verify new image is referenced and old data still exists
        let final_user = UserSvc::get_by_id(&context, user.id.unwrap()).unwrap();
        assert_eq!(final_user.image_id, Some(new_image.id));

        // Both images should still exist in the database
        let old_image = UserImageSvc::get_by_id(&context, created_image.id).unwrap();
        let new_image_retrieved = UserImageSvc::get_by_id(&context, new_image.id).unwrap();
        assert!(old_image.is_some());
        assert!(new_image_retrieved.is_some());

        // get_by_user_id should return the latest
        let latest_user_image = UserImageSvc::get_by_user_id(&context, user.id.unwrap()).unwrap();
        assert!(latest_user_image.is_some());
        assert_eq!(latest_user_image.unwrap().id, new_image.id);

        // Step 6: Clean up all images for user
        let deleted_count = UserImageSvc::delete_by_user_id(&context, user.id.unwrap()).unwrap();
        assert_eq!(deleted_count, 2); // Should delete both images

        UserImageSvc::update_user_image_reference(&context, user.id.unwrap(), None).unwrap();

        let clean_user = UserSvc::get_by_id(&context, user.id.unwrap()).unwrap();
        assert_eq!(clean_user.image_id, None);
    }
}

