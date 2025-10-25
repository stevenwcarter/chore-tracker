use crate::{context::GraphQLContext, db::get_conn, models::User, schema::users};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct UserSvc {}

impl UserSvc {
    pub fn get(context: &GraphQLContext, user_uuid: &str) -> Result<User> {
        users::table
            .filter(users::uuid.eq(user_uuid))
            .select(User::as_select())
            .first(&mut get_conn(context))
            .context("Could not find user")
    }

    pub fn get_by_id(context: &GraphQLContext, user_id: i32) -> Result<User> {
        users::table
            .filter(users::id.eq(user_id))
            .select(User::as_select())
            .first(&mut get_conn(context))
            .context("Could not find user")
    }

    pub fn list(context: &GraphQLContext, limit: i32, offset: i32) -> Result<Vec<User>> {
        let limit: i64 = limit.into();
        let offset: i64 = offset.into();

        users::table
            .select(User::as_select())
            .order_by(users::name.asc())
            .limit(limit)
            .offset(offset)
            .load::<User>(&mut get_conn(context))
            .context("Could not load users")
    }

    pub fn create(context: &GraphQLContext, user: &User) -> Result<User> {
        diesel::insert_into(users::table)
            .values(user)
            .execute(&mut get_conn(context))
            .context("Could not create user")?;

        Self::get(context, &user.uuid)
    }

    pub fn update(context: &GraphQLContext, user: &User) -> Result<User> {
        diesel::update(users::table)
            .filter(users::uuid.eq(&user.uuid))
            .set(user)
            .execute(&mut get_conn(context))
            .context("Could not update user")?;

        Self::get(context, &user.uuid)
    }

    pub fn delete(context: &GraphQLContext, user_uuid: &str) -> Result<()> {
        diesel::delete(users::table)
            .filter(users::uuid.eq(user_uuid))
            .execute(&mut get_conn(context))
            .context("Could not delete user")?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        models::UserInput,
        test_helpers::test_db::{create_test_context, create_test_user},
    };
    use uuid::Uuid;

    #[test]
    fn test_user_crud_operations() {
        let context = create_test_context();

        // Test creation
        let user = create_test_user(&context, "Test User");
        assert_eq!(user.name, "Test User");
        assert!(user.id.is_some());
        assert!(user.uuid.len() > 0);

        // Test get by UUID
        let retrieved = UserSvc::get(&context, &user.uuid).unwrap();
        assert_eq!(retrieved.uuid, user.uuid);
        assert_eq!(retrieved.name, user.name);

        // Test get by ID
        let retrieved_by_id = UserSvc::get_by_id(&context, user.id.unwrap()).unwrap();
        assert_eq!(retrieved_by_id.uuid, user.uuid);

        // Test update
        let updated_user = User {
            id: user.id,
            uuid: user.uuid.clone(),
            name: "Updated User".to_string(),
            image_path: Some("/path/to/image.jpg".to_string()),
            created_at: user.created_at,
            updated_at: user.updated_at,
            image_id: None,
        };

        let result = UserSvc::update(&context, &updated_user).unwrap();
        assert_eq!(result.name, "Updated User");
        assert_eq!(result.image_path, Some("/path/to/image.jpg".to_string()));

        // Test deletion
        UserSvc::delete(&context, &user.uuid).unwrap();
        let deleted_result = UserSvc::get(&context, &user.uuid);
        assert!(deleted_result.is_err());
    }

    #[test]
    fn test_user_listing() {
        let context = create_test_context();

        // Create multiple users
        let _user1 = create_test_user(&context, "Alice");
        let _user2 = create_test_user(&context, "Bob");
        let _user3 = create_test_user(&context, "Charlie");

        // Test listing all users
        let all_users = UserSvc::list(&context, 100, 0).unwrap();
        assert_eq!(all_users.len(), 3);
        
        // Should be ordered by name
        assert_eq!(all_users[0].name, "Alice");
        assert_eq!(all_users[1].name, "Bob");
        assert_eq!(all_users[2].name, "Charlie");

        // Test pagination
        let first_page = UserSvc::list(&context, 2, 0).unwrap();
        assert_eq!(first_page.len(), 2);
        assert_eq!(first_page[0].name, "Alice");
        assert_eq!(first_page[1].name, "Bob");

        let second_page = UserSvc::list(&context, 2, 2).unwrap();
        assert_eq!(second_page.len(), 1);
        assert_eq!(second_page[0].name, "Charlie");
    }

    #[test]
    fn test_user_creation_with_input() {
        let context = create_test_context();

        // Test creating user from UserInput
        let user_input = UserInput {
            uuid: Some(Uuid::now_v7().to_string()),
            name: "Input User".to_string(),
            image_path: Some("/custom/path.jpg".to_string()),
        };

        let user = User::from(user_input.clone());
        let created_user = UserSvc::create(&context, &user).unwrap();

        assert_eq!(created_user.name, "Input User");
        assert_eq!(created_user.image_path, Some("/custom/path.jpg".to_string()));
        assert_eq!(created_user.uuid, user_input.uuid.unwrap());
    }

    #[test]
    fn test_user_error_cases() {
        let context = create_test_context();

        // Test get non-existent user
        let result = UserSvc::get(&context, "non-existent-uuid");
        assert!(result.is_err());

        // Test get by non-existent ID
        let result = UserSvc::get_by_id(&context, 99999);
        assert!(result.is_err());

        // Test delete non-existent user (should not error)
        let result = UserSvc::delete(&context, "non-existent-uuid");
        assert!(result.is_ok()); // Diesel delete doesn't error if nothing is deleted
    }

    #[test]
    fn test_user_update_partial_fields() {
        let context = create_test_context();
        let user = create_test_user(&context, "Original User");

        // Test updating just the name
        let updated_user = User {
            id: user.id,
            uuid: user.uuid.clone(),
            name: "New Name".to_string(),
            image_path: user.image_path.clone(),
            created_at: user.created_at,
            updated_at: user.updated_at,
            image_id: user.image_id,
        };

        let result = UserSvc::update(&context, &updated_user).unwrap();
        assert_eq!(result.name, "New Name");
        assert_eq!(result.image_path, user.image_path); // Should remain unchanged

        // Test updating just the image path
        let updated_user = User {
            id: user.id,
            uuid: user.uuid.clone(),
            name: result.name.clone(),
            image_path: Some("/new/image.png".to_string()),
            created_at: user.created_at,
            updated_at: user.updated_at,
            image_id: user.image_id,
        };

        let result = UserSvc::update(&context, &updated_user).unwrap();
        assert_eq!(result.name, "New Name"); // Should remain unchanged
        assert_eq!(result.image_path, Some("/new/image.png".to_string()));
    }
}