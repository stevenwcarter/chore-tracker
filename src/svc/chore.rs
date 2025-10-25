use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{Chore, ChoreAssignment},
    schema::{chore_assignments, chores, users},
};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct ChoreSvc {}

impl ChoreSvc {
    pub fn get(context: &GraphQLContext, chore_uuid: &str) -> Result<Chore> {
        chores::table
            .filter(chores::uuid.eq(chore_uuid))
            .select(Chore::as_select())
            .first(&mut get_conn(context))
            .context("Could not find chore")
    }

    pub fn get_by_id(context: &GraphQLContext, chore_id: i32) -> Result<Chore> {
        chores::table
            .filter(chores::id.eq(chore_id))
            .select(Chore::as_select())
            .first(&mut get_conn(context))
            .context("Could not find chore by ID")
    }

    pub fn list(
        context: &GraphQLContext,
        user_id: Option<i32>,
        active_only: bool,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<Chore>> {
        let limit: i64 = limit.into();
        let offset: i64 = offset.into();

        if let Some(user_id) = user_id {
            // When filtering by user, we need to join with assignments
            let mut query = chores::table
                .inner_join(chore_assignments::table)
                .filter(chore_assignments::user_id.eq(user_id))
                .into_boxed();

            if active_only {
                query = query.filter(chores::active.eq(true));
            }

            query
                .select(Chore::as_select())
                .order_by(chores::name.asc())
                .limit(limit)
                .offset(offset)
                .load::<Chore>(&mut get_conn(context))
                .context("Could not load chores for user")
        } else {
            // When not filtering by user, simple query
            let mut query = chores::table.into_boxed();

            if active_only {
                query = query.filter(chores::active.eq(true));
            }

            query
                .select(Chore::as_select())
                .order_by(chores::name.asc())
                .limit(limit)
                .offset(offset)
                .load::<Chore>(&mut get_conn(context))
                .context("Could not load chores")
        }
    }

    pub fn create(context: &GraphQLContext, chore: &Chore) -> Result<Chore> {
        diesel::insert_into(chores::table)
            .values(chore)
            .execute(&mut get_conn(context))
            .context("Could not create chore")?;

        Self::get(context, &chore.uuid)
    }

    pub fn update(context: &GraphQLContext, chore: &Chore) -> Result<Chore> {
        diesel::update(chores::table)
            .filter(chores::uuid.eq(&chore.uuid))
            .set(chore)
            .execute(&mut get_conn(context))
            .context("Could not update chore")?;

        Self::get(context, &chore.uuid)
    }

    pub fn delete(context: &GraphQLContext, chore_uuid: &str) -> Result<()> {
        diesel::delete(chores::table)
            .filter(chores::uuid.eq(chore_uuid))
            .execute(&mut get_conn(context))
            .context("Could not delete chore")?;

        Ok(())
    }

    pub fn assign_user(context: &GraphQLContext, chore_id: i32, user_id: i32) -> Result<()> {
        // Check if the assignment already exists
        let existing = chore_assignments::table
            .filter(
                chore_assignments::chore_id
                    .eq(chore_id)
                    .and(chore_assignments::user_id.eq(user_id)),
            )
            .first::<ChoreAssignment>(&mut get_conn(context))
            .optional()
            .context("Could not check existing assignment")?;

        // If assignment already exists, return early
        if existing.is_some() {
            return Ok(());
        }

        let assignment = ChoreAssignment {
            id: None,
            chore_id,
            user_id,
            created_at: None,
        };

        diesel::insert_into(chore_assignments::table)
            .values(&assignment)
            .execute(&mut get_conn(context))
            .context("Could not assign user to chore")?;

        Ok(())
    }

    pub fn unassign_user(context: &GraphQLContext, chore_id: i32, user_id: i32) -> Result<()> {
        diesel::delete(chore_assignments::table)
            .filter(
                chore_assignments::chore_id
                    .eq(chore_id)
                    .and(chore_assignments::user_id.eq(user_id)),
            )
            .execute(&mut get_conn(context))
            .context("Could not unassign user from chore")?;

        Ok(())
    }

    pub fn get_assigned_users(
        context: &GraphQLContext,
        chore_id: i32,
    ) -> Result<Vec<crate::models::User>> {
        chore_assignments::table
            .inner_join(users::table)
            .filter(chore_assignments::chore_id.eq(chore_id))
            .select(crate::models::User::as_select())
            .load(&mut get_conn(context))
            .context("Could not load assigned users")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        models::{ChoreInput, PaymentType},
        test_helpers::test_db::{
            create_test_admin, create_test_chore, create_test_context, create_test_user,
            day_patterns,
        },
    };

    #[test]
    fn test_chore_crud_operations() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");

        // Test creation
        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            150,
            day_patterns::weekdays(),
            admin.id.unwrap(),
        );

        assert_eq!(chore.name, "Test Chore");
        assert_eq!(chore.amount_cents, 150);
        assert_eq!(chore.payment_type, "daily");
        assert_eq!(chore.required_days, day_patterns::weekdays());
        assert!(chore.active);

        // Test get by UUID
        let retrieved = ChoreSvc::get(&context, &chore.uuid).unwrap();
        assert_eq!(retrieved.uuid, chore.uuid);
        assert_eq!(retrieved.name, chore.name);

        // Test get by ID
        let retrieved_by_id = ChoreSvc::get_by_id(&context, chore.id.unwrap()).unwrap();
        assert_eq!(retrieved_by_id.uuid, chore.uuid);

        // Test update
        let updated_chore = Chore {
            id: chore.id,
            uuid: chore.uuid.clone(),
            name: "Updated Chore".to_string(),
            description: chore.description.clone(),
            payment_type: chore.payment_type.clone(),
            amount_cents: 200,
            required_days: chore.required_days,
            active: false,
            created_by_admin_id: chore.created_by_admin_id,
            created_at: chore.created_at,
            updated_at: chore.updated_at,
        };

        let result = ChoreSvc::update(&context, &updated_chore).unwrap();
        assert_eq!(result.name, "Updated Chore");
        assert_eq!(result.amount_cents, 200);
        assert!(!result.active);

        // Test deletion
        ChoreSvc::delete(&context, &chore.uuid).unwrap();
        let deleted_result = ChoreSvc::get(&context, &chore.uuid);
        assert!(deleted_result.is_err());
    }

    #[test]
    fn test_chore_listing() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");

        // Create multiple chores
        let _chore1 = create_test_chore(
            &context,
            "Active Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        let chore2_input = ChoreInput {
            uuid: None,
            name: "Inactive Chore".to_string(),
            description: Some("Test inactive chore".to_string()),
            payment_type: PaymentType::Weekly,
            amount_cents: 200,
            required_days: day_patterns::weekdays(),
            active: Some(false), // Inactive
            created_by_admin_id: admin.id.unwrap(),
        };
        let chore2 = Chore::from(chore2_input);
        let _chore2 = ChoreSvc::create(&context, &chore2).unwrap();

        let _chore3 = create_test_chore(
            &context,
            "Z Last Chore", // Name starts with Z to test ordering
            PaymentType::Daily,
            75,
            day_patterns::monday_only(),
            admin.id.unwrap(),
        );

        // Test listing all chores (including inactive)
        let all_chores = ChoreSvc::list(&context, None, false, 100, 0).unwrap();
        assert_eq!(all_chores.len(), 3);
        // Should be ordered by name
        assert_eq!(all_chores[0].name, "Active Chore");
        assert_eq!(all_chores[1].name, "Inactive Chore");
        assert_eq!(all_chores[2].name, "Z Last Chore");

        // Test listing only active chores
        let active_chores = ChoreSvc::list(&context, None, true, 100, 0).unwrap();
        assert_eq!(active_chores.len(), 2);
        assert!(active_chores.iter().all(|c| c.active));

        // Test pagination
        let first_page = ChoreSvc::list(&context, None, false, 2, 0).unwrap();
        assert_eq!(first_page.len(), 2);

        let second_page = ChoreSvc::list(&context, None, false, 2, 2).unwrap();
        assert_eq!(second_page.len(), 1);
        assert_eq!(second_page[0].name, "Z Last Chore");
    }

    #[test]
    fn test_chore_user_assignments() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");
        let _user3 = create_test_user(&context, "User 3");

        let chore = create_test_chore(
            &context,
            "Assignment Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::weekdays(),
            admin.id.unwrap(),
        );

        // Initially no users assigned
        let assigned_users = ChoreSvc::get_assigned_users(&context, chore.id.unwrap()).unwrap();
        assert_eq!(assigned_users.len(), 0);

        // Assign user1
        ChoreSvc::assign_user(&context, chore.id.unwrap(), user1.id.unwrap()).unwrap();
        let assigned_users = ChoreSvc::get_assigned_users(&context, chore.id.unwrap()).unwrap();
        assert_eq!(assigned_users.len(), 1);
        assert_eq!(assigned_users[0].id, user1.id);

        // Assign user2
        ChoreSvc::assign_user(&context, chore.id.unwrap(), user2.id.unwrap()).unwrap();
        let assigned_users = ChoreSvc::get_assigned_users(&context, chore.id.unwrap()).unwrap();
        assert_eq!(assigned_users.len(), 2);

        // Try to assign user1 again (should be idempotent)
        ChoreSvc::assign_user(&context, chore.id.unwrap(), user1.id.unwrap()).unwrap();
        let assigned_users = ChoreSvc::get_assigned_users(&context, chore.id.unwrap()).unwrap();
        assert_eq!(assigned_users.len(), 2); // Still only 2 users

        // Unassign user1
        ChoreSvc::unassign_user(&context, chore.id.unwrap(), user1.id.unwrap()).unwrap();
        let assigned_users = ChoreSvc::get_assigned_users(&context, chore.id.unwrap()).unwrap();
        assert_eq!(assigned_users.len(), 1);
        assert_eq!(assigned_users[0].id, user2.id);

        // Unassign user2
        ChoreSvc::unassign_user(&context, chore.id.unwrap(), user2.id.unwrap()).unwrap();
        let assigned_users = ChoreSvc::get_assigned_users(&context, chore.id.unwrap()).unwrap();
        assert_eq!(assigned_users.len(), 0);
    }

    #[test]
    fn test_list_chores_by_user() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");

        // Create chores
        let chore1 = create_test_chore(
            &context,
            "Chore 1",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        let chore2 = create_test_chore(
            &context,
            "Chore 2",
            PaymentType::Weekly,
            200,
            day_patterns::weekdays(),
            admin.id.unwrap(),
        );

        let chore3_input = ChoreInput {
            uuid: None,
            name: "Inactive Chore".to_string(),
            description: None,
            payment_type: PaymentType::Daily,
            amount_cents: 150,
            required_days: day_patterns::monday_only(),
            active: Some(false), // Inactive
            created_by_admin_id: admin.id.unwrap(),
        };
        let chore3 = Chore::from(chore3_input);
        let chore3 = ChoreSvc::create(&context, &chore3).unwrap();

        // Assign chores to users
        ChoreSvc::assign_user(&context, chore1.id.unwrap(), user1.id.unwrap()).unwrap();
        ChoreSvc::assign_user(&context, chore2.id.unwrap(), user1.id.unwrap()).unwrap();
        ChoreSvc::assign_user(&context, chore3.id.unwrap(), user1.id.unwrap()).unwrap(); // Inactive chore

        ChoreSvc::assign_user(&context, chore2.id.unwrap(), user2.id.unwrap()).unwrap();

        // Test listing all chores for user1 (including inactive)
        let user1_all_chores = ChoreSvc::list(&context, Some(user1.id.unwrap()), false, 100, 0).unwrap();
        assert_eq!(user1_all_chores.len(), 3);

        // Test listing only active chores for user1
        let user1_active_chores = ChoreSvc::list(&context, Some(user1.id.unwrap()), true, 100, 0).unwrap();
        assert_eq!(user1_active_chores.len(), 2);
        assert!(user1_active_chores.iter().all(|c| c.active));

        // Test listing chores for user2
        let user2_chores = ChoreSvc::list(&context, Some(user2.id.unwrap()), false, 100, 0).unwrap();
        assert_eq!(user2_chores.len(), 1);
        assert_eq!(user2_chores[0].uuid, chore2.uuid);

        // Test user with no assigned chores
        let user_no_chores = create_test_user(&context, "User No Chores");
        let no_chores = ChoreSvc::list(&context, Some(user_no_chores.id.unwrap()), false, 100, 0).unwrap();
        assert_eq!(no_chores.len(), 0);
    }

    #[test]
    fn test_chore_error_cases() {
        let context = create_test_context();

        // Test get non-existent chore
        let result = ChoreSvc::get(&context, "non-existent-uuid");
        assert!(result.is_err());

        // Test get by non-existent ID
        let result = ChoreSvc::get_by_id(&context, 99999);
        assert!(result.is_err());

        // Test delete non-existent chore (should not error)
        let result = ChoreSvc::delete(&context, "non-existent-uuid");
        assert!(result.is_ok()); // Diesel delete doesn't error if nothing is deleted

        // Test assign user to non-existent chore
        let user = create_test_user(&context, "Test User");
        let result = ChoreSvc::assign_user(&context, 99999, user.id.unwrap());
        assert!(result.is_err()); // Should fail due to foreign key constraint

        // Test unassign from non-existent assignment (should not error)
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );
        let result = ChoreSvc::unassign_user(&context, chore.id.unwrap(), user.id.unwrap());
        assert!(result.is_ok()); // Should not error even if assignment doesn't exist
    }
}