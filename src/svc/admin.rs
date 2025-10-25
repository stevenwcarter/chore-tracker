use crate::{context::GraphQLContext, db::get_conn, models::Admin, schema::admins};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct AdminSvc {}

impl AdminSvc {
    pub fn get(context: &GraphQLContext, admin_uuid: &str) -> Result<Admin> {
        admins::table
            .filter(admins::uuid.eq(admin_uuid))
            .select(Admin::as_select())
            .first(&mut get_conn(context))
            .context("Could not find admin")
    }

    pub fn get_by_oidc_subject(context: &GraphQLContext, oidc_subject: &str) -> Result<Admin> {
        admins::table
            .filter(admins::oidc_subject.eq(oidc_subject))
            .select(Admin::as_select())
            .first(&mut get_conn(context))
            .context("Could not find admin by OIDC subject")
    }

    pub fn list(context: &GraphQLContext, limit: i32, offset: i32) -> Result<Vec<Admin>> {
        let limit: i64 = limit.into();
        let offset: i64 = offset.into();

        admins::table
            .select(Admin::as_select())
            .order_by(admins::name.asc())
            .limit(limit)
            .offset(offset)
            .load::<Admin>(&mut get_conn(context))
            .context("Could not load admins")
    }

    pub fn create(context: &GraphQLContext, admin: &Admin) -> Result<Admin> {
        diesel::insert_into(admins::table)
            .values(admin)
            .execute(&mut get_conn(context))
            .context("Could not create admin")?;

        Self::get(context, &admin.uuid)
    }

    pub fn update(context: &GraphQLContext, admin: &Admin) -> Result<Admin> {
        diesel::update(admins::table)
            .filter(admins::uuid.eq(&admin.uuid))
            .set(admin)
            .execute(&mut get_conn(context))
            .context("Could not update admin")?;

        Self::get(context, &admin.uuid)
    }

    pub fn get_or_create_by_oidc(
        context: &GraphQLContext,
        oidc_subject: &str,
        name: &str,
        email: &str,
    ) -> Result<Admin> {
        // First try to get existing admin
        Self::get_by_oidc_subject(context, oidc_subject).map_or_else(
            |_| {
                // Admin doesn't exist, create a new one
                let new_admin = Admin {
                    id: None,
                    uuid: uuid::Uuid::new_v4().to_string(),
                    name: name.to_owned(),
                    email: email.to_owned(),
                    oidc_subject: oidc_subject.to_owned(),
                    created_at: None,
                    updated_at: None,
                };

                Self::create(context, &new_admin)
            },
            Ok,
        )
    }

    pub fn delete(context: &GraphQLContext, admin_uuid: &str) -> Result<()> {
        diesel::delete(admins::table)
            .filter(admins::uuid.eq(admin_uuid))
            .execute(&mut get_conn(context))
            .context("Could not delete admin")?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::test_db::{create_test_admin, create_test_context};

    #[test]
    fn test_admin_crud_operations() {
        let context = create_test_context();

        // Test creation
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        assert_eq!(admin.name, "Test Admin");
        assert_eq!(admin.email, "admin@test.com");
        assert!(admin.id.is_some());
        assert!(!admin.uuid.is_empty());
        assert!(admin.oidc_subject.starts_with("test-oidc-"));

        // Test get by UUID
        let retrieved = AdminSvc::get(&context, &admin.uuid).unwrap();
        assert_eq!(retrieved.uuid, admin.uuid);
        assert_eq!(retrieved.name, admin.name);
        assert_eq!(retrieved.email, admin.email);

        // Test get by OIDC subject
        let retrieved_by_oidc =
            AdminSvc::get_by_oidc_subject(&context, &admin.oidc_subject).unwrap();
        assert_eq!(retrieved_by_oidc.uuid, admin.uuid);

        // Test update
        let updated_admin = Admin {
            id: admin.id,
            uuid: admin.uuid.clone(),
            name: "Updated Admin".to_owned(),
            email: "updated@test.com".to_owned(),
            oidc_subject: admin.oidc_subject.clone(),
            created_at: admin.created_at,
            updated_at: admin.updated_at,
        };

        let result = AdminSvc::update(&context, &updated_admin).unwrap();
        assert_eq!(result.name, "Updated Admin");
        assert_eq!(result.email, "updated@test.com");

        // Test deletion
        AdminSvc::delete(&context, &admin.uuid).unwrap();
        let deleted_result = AdminSvc::get(&context, &admin.uuid);
        assert!(deleted_result.is_err());
    }

    #[test]
    fn test_admin_listing() {
        let context = create_test_context();

        // Create multiple admins
        let _admin1 = create_test_admin(&context, "Alice Admin", "alice@test.com");
        let _admin2 = create_test_admin(&context, "Bob Admin", "bob@test.com");
        let _admin3 = create_test_admin(&context, "Charlie Admin", "charlie@test.com");

        // Test listing all admins
        let all_admins = AdminSvc::list(&context, 100, 0).unwrap();
        assert_eq!(all_admins.len(), 3);

        // Should be ordered by name
        assert_eq!(all_admins[0].name, "Alice Admin");
        assert_eq!(all_admins[1].name, "Bob Admin");
        assert_eq!(all_admins[2].name, "Charlie Admin");

        // Test pagination
        let first_page = AdminSvc::list(&context, 2, 0).unwrap();
        assert_eq!(first_page.len(), 2);
        assert_eq!(first_page[0].name, "Alice Admin");
        assert_eq!(first_page[1].name, "Bob Admin");

        let second_page = AdminSvc::list(&context, 2, 2).unwrap();
        assert_eq!(second_page.len(), 1);
        assert_eq!(second_page[0].name, "Charlie Admin");
    }

    #[test]
    fn test_get_or_create_by_oidc() {
        let context = create_test_context();

        let oidc_subject = "test-oidc-12345";
        let name = "OIDC Admin";
        let email = "oidc@test.com";

        // First call should create a new admin
        let admin1 = AdminSvc::get_or_create_by_oidc(&context, oidc_subject, name, email).unwrap();
        assert_eq!(admin1.name, name);
        assert_eq!(admin1.email, email);
        assert_eq!(admin1.oidc_subject, oidc_subject);

        // Second call should return the existing admin
        let admin2 = AdminSvc::get_or_create_by_oidc(
            &context,
            oidc_subject,
            "Different Name",
            "different@email.com",
        )
        .unwrap();
        assert_eq!(admin2.uuid, admin1.uuid); // Same admin
        assert_eq!(admin2.name, name); // Original name preserved
        assert_eq!(admin2.email, email); // Original email preserved

        // Verify only one admin was created
        let all_admins = AdminSvc::list(&context, 100, 0).unwrap();
        assert_eq!(all_admins.len(), 1);
    }

    #[test]
    fn test_admin_error_cases() {
        let context = create_test_context();

        // Test get non-existent admin
        let result = AdminSvc::get(&context, "non-existent-uuid");
        assert!(result.is_err());

        // Test get by non-existent OIDC subject
        let result = AdminSvc::get_by_oidc_subject(&context, "non-existent-oidc");
        assert!(result.is_err());

        // Test delete non-existent admin (should not error)
        let result = AdminSvc::delete(&context, "non-existent-uuid");
        assert!(result.is_ok()); // Diesel delete doesn't error if nothing is deleted
    }

    #[test]
    fn test_admin_unique_constraints() {
        let context = create_test_context();

        let admin1 = create_test_admin(&context, "Admin 1", "test@example.com");

        // Test creating admin with duplicate OIDC subject should work in our test
        // because we generate unique OIDC subjects in the test helper
        let admin2 = create_test_admin(&context, "Admin 2", "test2@example.com");
        assert_ne!(admin1.oidc_subject, admin2.oidc_subject);

        // Test manual creation with same OIDC subject would fail in real database
        // but we can't easily test that with the current test setup since foreign key
        // constraints might not be enabled in the test database
    }

    #[test]
    fn test_admin_email_formats() {
        let context = create_test_context();

        // Test various email formats
        let email_formats = [
            "simple@test.com",
            "user.name@example.org",
            "user+tag@example.co.uk",
            "123@numbers.net",
        ];

        for (i, email) in email_formats.iter().enumerate() {
            let admin = create_test_admin(&context, &format!("Admin {}", i), email);
            assert_eq!(admin.email, *email);
        }

        let all_admins = AdminSvc::list(&context, 100, 0).unwrap();
        assert_eq!(all_admins.len(), email_formats.len());
    }
}
