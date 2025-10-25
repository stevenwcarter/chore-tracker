#[cfg(test)]
pub mod test_db {
    use chrono::Datelike;
    use crate::{
        context::GraphQLContext,
        db::{run_migrations, ConnectionOptions},
        models::{Admin, Chore, ChoreAssignment, ChoreInput, PaymentType, User},
        schema::{admins, chore_assignments, chores, users},
    };
    use chrono::{NaiveDate, Utc};
    use diesel::{
        prelude::*,
        r2d2::{ConnectionManager, Pool},
        sqlite::SqliteConnection,
    };
    use std::time::Duration;
    use uuid::Uuid;

    pub type TestPool = Pool<ConnectionManager<SqliteConnection>>;

    /// Creates an in-memory SQLite database for testing
    pub fn create_test_pool() -> TestPool {
        let mgr = ConnectionManager::<SqliteConnection>::new(":memory:");
        let pool = Pool::builder()
            .min_idle(Some(1))
            .max_size(1) // Single connection for in-memory DB
            .connection_customizer(Box::new(ConnectionOptions {
                busy_timeout: Some(Duration::from_secs(1)),
            }))
            .build(mgr)
            .expect("Failed to create test database pool");

        // Run migrations
        let mut conn = pool.get().expect("Failed to get connection");
        run_migrations(&mut conn).expect("Failed to run migrations");

        pool
    }

    /// Creates a test GraphQL context with in-memory database
    pub fn create_test_context() -> GraphQLContext {
        let pool = create_test_pool();
        GraphQLContext { pool }
    }

    /// Test data factory for creating users
    pub fn create_test_user(context: &GraphQLContext, name: &str) -> User {
        let user = User {
            id: None,
            uuid: Uuid::now_v7().to_string(),
            name: name.to_string(),
            image_path: None,
            created_at: None,
            updated_at: None,
            image_id: None,
        };

        diesel::insert_into(users::table)
            .values(&user)
            .execute(&mut context.pool.get().unwrap())
            .unwrap();

        users::table
            .filter(users::uuid.eq(&user.uuid))
            .select(User::as_select())
            .first(&mut context.pool.get().unwrap())
            .unwrap()
    }

    /// Test data factory for creating admins
    pub fn create_test_admin(context: &GraphQLContext, name: &str, email: &str) -> Admin {
        let admin = Admin {
            id: None,
            uuid: Uuid::now_v7().to_string(),
            name: name.to_string(),
            email: email.to_string(),
            oidc_subject: format!("test-oidc-{}", Uuid::now_v7()),
            created_at: None,
            updated_at: None,
        };

        diesel::insert_into(admins::table)
            .values(&admin)
            .execute(&mut context.pool.get().unwrap())
            .unwrap();

        admins::table
            .filter(admins::uuid.eq(&admin.uuid))
            .select(Admin::as_select())
            .first(&mut context.pool.get().unwrap())
            .unwrap()
    }

    /// Test data factory for creating chores
    pub fn create_test_chore(
        context: &GraphQLContext,
        name: &str,
        payment_type: PaymentType,
        amount_cents: i32,
        required_days: i32,
        admin_id: i32,
    ) -> Chore {
        let chore_input = ChoreInput {
            uuid: None,
            name: name.to_string(),
            description: Some(format!("Test description for {}", name)),
            payment_type,
            amount_cents,
            required_days,
            active: Some(true),
            created_by_admin_id: admin_id,
        };

        let chore = Chore::from(chore_input);

        diesel::insert_into(chores::table)
            .values(&chore)
            .execute(&mut context.pool.get().unwrap())
            .unwrap();

        chores::table
            .filter(chores::uuid.eq(&chore.uuid))
            .select(Chore::as_select())
            .first(&mut context.pool.get().unwrap())
            .unwrap()
    }

    /// Test data factory for creating chore assignments
    pub fn create_test_chore_assignment(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
    ) -> ChoreAssignment {
        let assignment = ChoreAssignment {
            id: None,
            chore_id,
            user_id,
            created_at: None,
        };

        diesel::insert_into(chore_assignments::table)
            .values(&assignment)
            .execute(&mut context.pool.get().unwrap())
            .unwrap();

        chore_assignments::table
            .filter(chore_assignments::chore_id.eq(chore_id))
            .filter(chore_assignments::user_id.eq(user_id))
            .select(ChoreAssignment::as_select())
            .first(&mut context.pool.get().unwrap())
            .unwrap()
    }

    /// Helper function to get Monday of current week for testing
    pub fn get_test_week_start() -> NaiveDate {
        let today = Utc::now().date_naive();
        let days_since_monday = today.weekday().num_days_from_monday();
        today - chrono::Duration::days(days_since_monday as i64)
    }

    /// Helper function to create a specific date for testing
    pub fn create_test_date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("Invalid test date")
    }

    /// Helper to calculate bitmask for days of week
    /// Monday = 1, Tuesday = 2, Wednesday = 4, Thursday = 8, Friday = 16, Saturday = 32, Sunday = 64
    pub fn days_bitmask(days: &[u8]) -> i32 {
        days.iter().fold(0, |acc, &day| acc | (1 << (day - 1)))
    }

    /// Common test patterns for required days
    pub mod day_patterns {
        use super::days_bitmask;

        /// Monday, Wednesday, Friday (common pattern)
        pub fn mon_wed_fri() -> i32 {
            days_bitmask(&[1, 3, 5]) // 1 + 4 + 16 = 21
        }

        /// All weekdays (Monday through Friday)
        pub fn weekdays() -> i32 {
            days_bitmask(&[1, 2, 3, 4, 5]) // 1 + 2 + 4 + 8 + 16 = 31
        }

        /// Every day
        pub fn every_day() -> i32 {
            days_bitmask(&[1, 2, 3, 4, 5, 6, 7]) // 127
        }

        /// Just Monday
        pub fn monday_only() -> i32 {
            days_bitmask(&[1]) // 1
        }
    }
}