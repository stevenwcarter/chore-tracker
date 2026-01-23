use crate::{context::GraphQLContext, db::get_conn, get_env, models::User, schema::users};
use anyhow::{Context, Result};
use diesel::prelude::*;
use juniper::GraphQLObject;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use ynab_api::{
    apis::{categories_api::get_categories, configuration::Configuration},
    models::CategoriesResponse,
};

#[derive(Debug, Clone, Serialize, Deserialize, GraphQLObject)]
pub struct UserBalance {
    pub name: String,
    pub balance: f64,
}

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

    pub async fn balances(_context: &GraphQLContext) -> Result<Vec<UserBalance>> {
        let ynab_token = get_env("YNAB_TOKEN", "NOT_SET");
        let client = Client::new();
        let budget_id = "0dcd28d3-c3e8-4f3d-a64f-f63b5f12f87f";
        let configuration = Configuration {
            base_path: "https://api.ynab.com/v1/".to_owned(),
            client,
            bearer_access_token: Some(ynab_token),
            ..Default::default()
        };
        let categories: CategoriesResponse = get_categories(&configuration, budget_id, None)
            .await
            .context("could not get categories")?;
        let group = categories
            .data
            .category_groups
            .iter()
            .find(|g| g.name == "Kids Allowances")
            .unwrap();
        let aurora = group
            .categories
            .iter()
            .find(|c| c.name == "Aurora Cash")
            .unwrap()
            .balance as f64
            / 1000.0;
        let madeline = group
            .categories
            .iter()
            .find(|c| c.name == "Madeline Cash")
            .unwrap()
            .balance as f64
            / 1000.0;
        let aj = group
            .categories
            .iter()
            .find(|c| c.name == "AJ Cash")
            .unwrap()
            .balance as f64
            / 1000.0;
        // TODO - add user balances
        Ok(vec![
            UserBalance {
                name: "Aurora".to_owned(),
                balance: aurora,
            },
            UserBalance {
                name: "Madeline".to_owned(),
                balance: madeline,
            },
            UserBalance {
                name: "AJ".to_owned(),
                balance: aj,
            },
        ])
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
        assert!(!user.uuid.is_empty());

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
            name: "Updated User".to_owned(),
            image_path: Some("/path/to/image.jpg".to_owned()),
            created_at: user.created_at,
            updated_at: user.updated_at,
            image_id: None,
        };

        let result = UserSvc::update(&context, &updated_user).unwrap();
        assert_eq!(result.name, "Updated User");
        assert_eq!(result.image_path, Some("/path/to/image.jpg".to_owned()));

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
            name: "Input User".to_owned(),
            image_path: Some("/custom/path.jpg".to_owned()),
        };

        let user = User::from(user_input.clone());
        let created_user = UserSvc::create(&context, &user).unwrap();

        assert_eq!(created_user.name, "Input User");
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
            name: "New Name".to_owned(),
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
            name: result.name,
            image_path: Some("/new/image.png".to_owned()),
            created_at: user.created_at,
            updated_at: user.updated_at,
            image_id: user.image_id,
        };

        let result = UserSvc::update(&context, &updated_user).unwrap();
        assert_eq!(result.name, "New Name"); // Should remain unchanged
        assert_eq!(result.image_path, Some("/new/image.png".to_owned()));
    }
}
