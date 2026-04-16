use anyhow::{Context, Result};
use chrono::NaiveDate;
use diesel::prelude::*;

use crate::context::GraphQLContext;
use crate::db::get_conn;
use crate::models::BadgeType;

pub struct BadgeSvc;

impl BadgeSvc {
    /// Check all badge conditions for the given user and insert any newly earned badges.
    /// This function is non-fatal: errors are logged but do not propagate.
    pub fn check_and_award(context: &GraphQLContext, user_id: i32) {
        for badge_type in BadgeType::all() {
            let earned = match Self::is_earned(context, user_id, &badge_type) {
                Ok(b) => b,
                Err(e) => {
                    tracing::warn!("Badge check failed for {:?}: {:?}", badge_type, e);
                    continue;
                }
            };
            if earned {
                let mut conn = match get_conn(context) {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::warn!("Badge award failed for {:?}: {:?}", badge_type, e);
                        continue;
                    }
                };
                if let Err(e) = Self::award(&mut conn, user_id, &badge_type) {
                    tracing::warn!("Badge award failed for {:?}: {:?}", badge_type, e);
                }
            }
        }
    }

    fn is_earned(context: &GraphQLContext, user_id: i32, badge_type: &BadgeType) -> Result<bool> {
        match badge_type {
            BadgeType::FirstChore => Self::check_first_chore(context, user_id),
            BadgeType::TenDollarsEarned => Self::check_earnings(context, user_id, 1000),
            BadgeType::FiftyDollarsEarned => Self::check_earnings(context, user_id, 5000),
            BadgeType::PerfectWeek => Self::check_perfect_week(context, user_id),
            BadgeType::FiveDayStreak => Self::check_five_day_streak(context, user_id),
        }
    }

    fn award(conn: &mut SqliteConnection, user_id: i32, badge_type: &BadgeType) -> Result<()> {
        use crate::schema::user_badges;
        let now = chrono::Local::now().naive_local();

        // Use insert_or_ignore to handle the UNIQUE(user_id, badge_type) constraint idempotently
        diesel::insert_or_ignore_into(user_badges::table)
            .values((
                user_badges::user_id.eq(user_id),
                user_badges::badge_type.eq(badge_type.as_str()),
                user_badges::earned_at.eq(now),
            ))
            .execute(conn)
            .context("Failed to insert badge")?;
        Ok(())
    }

    fn check_first_chore(context: &GraphQLContext, user_id: i32) -> Result<bool> {
        use crate::schema::chore_completions;
        let count: i64 = chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::approved.eq(true))
            .count()
            .get_result(&mut get_conn(context)?)
            .context("check_first_chore")?;
        Ok(count >= 1)
    }

    fn check_earnings(context: &GraphQLContext, user_id: i32, min_cents: i32) -> Result<bool> {
        use crate::schema::chore_completions;
        let total: Option<i64> = chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::approved.eq(true))
            .select(diesel::dsl::sum(chore_completions::amount_cents))
            .first(&mut get_conn(context)?)
            .context("check_earnings")?;
        Ok(total.unwrap_or(0) >= min_cents as i64)
    }

    fn check_perfect_week(context: &GraphQLContext, user_id: i32) -> Result<bool> {
        use crate::schema::chore_assignments;
        use crate::schema::chore_completions;

        // Get all chores assigned to this user
        let assigned_chore_ids: Vec<i32> = chore_assignments::table
            .filter(chore_assignments::user_id.eq(user_id))
            .select(chore_assignments::chore_id)
            .load::<i32>(&mut get_conn(context)?)
            .context("check_perfect_week assignments")?;

        if assigned_chore_ids.is_empty() {
            return Ok(false);
        }

        // Get all approved completions with chore_id and date for this user
        let completion_records: Vec<(i32, NaiveDate)> = chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::approved.eq(true))
            .select((chore_completions::chore_id, chore_completions::completed_date))
            .load(&mut get_conn(context)?)
            .context("check_perfect_week records")?;

        if completion_records.is_empty() {
            return Ok(false);
        }

        // Group completed chore_ids by ISO week
        use chrono::Datelike;
        use std::collections::{HashMap, HashSet};
        let mut week_completions: HashMap<(i32, u32), HashSet<i32>> = HashMap::new();
        for (chore_id, date) in &completion_records {
            let iso_week = date.iso_week();
            week_completions
                .entry((iso_week.year(), iso_week.week()))
                .or_default()
                .insert(*chore_id);
        }

        let assigned_set: HashSet<i32> = assigned_chore_ids.into_iter().collect();
        for completed_in_week in week_completions.values() {
            if assigned_set.is_subset(completed_in_week) {
                return Ok(true);
            }
        }
        Ok(false)
    }

    fn check_five_day_streak(context: &GraphQLContext, user_id: i32) -> Result<bool> {
        use crate::schema::chore_completions;

        let mut dates: Vec<NaiveDate> = chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::approved.eq(true))
            .select(chore_completions::completed_date)
            .load(&mut get_conn(context)?)
            .context("check_five_day_streak")?;

        if dates.is_empty() {
            return Ok(false);
        }

        // Deduplicate and sort
        dates.sort();
        dates.dedup();

        let mut streak = 1usize;
        for i in 1..dates.len() {
            let diff = (dates[i] - dates[i - 1]).num_days();
            if diff == 1 {
                streak += 1;
                if streak >= 5 {
                    return Ok(true);
                }
            } else {
                streak = 1;
            }
        }
        Ok(false)
    }

    /// Public test wrapper for check_five_day_streak.
    #[cfg(test)]
    pub fn check_five_day_streak_pub(context: &GraphQLContext, user_id: i32) -> Result<bool> {
        Self::check_five_day_streak(context, user_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UserBadge;
    use crate::{
        models::{ChoreCompletionInput, PaymentType},
        test_helpers::test_db::{
            create_test_admin, create_test_chore, create_test_context, create_test_user,
            day_patterns,
        },
    };
    use crate::svc::{ChoreSvc, ChoreCompletionSvc};

    fn setup_approved_completion(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
        admin_id: i32,
        date: NaiveDate,
    ) -> crate::models::ChoreCompletion {
        ChoreSvc::assign_user(context, chore_id, user_id).unwrap();
        let input = ChoreCompletionInput {
            uuid: None,
            chore_id,
            user_id,
            completed_date: date,
        };
        let completion = ChoreCompletionSvc::create(context, &input).unwrap();
        ChoreCompletionSvc::approve(context, &completion.uuid, admin_id).unwrap()
    }

    #[test]
    fn test_check_and_award_first_chore_badge() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );
        let chore_id = chore.id.unwrap();
        let user_id = user.id.unwrap();
        let admin_id = admin.id.unwrap();

        let today = NaiveDate::from_ymd_opt(2026, 4, 15).unwrap();
        setup_approved_completion(&context, chore_id, user_id, admin_id, today);

        // check_and_award should award first_chore badge
        BadgeSvc::check_and_award(&context, user_id);

        // Verify badge was awarded
        use crate::schema::user_badges;
        let conn = &mut context.pool.get().unwrap();
        let badges: Vec<UserBadge> = user_badges::table
            .filter(user_badges::user_id.eq(user_id))
            .load(conn)
            .unwrap();
        let first_chore_count = badges.iter().filter(|b| b.badge_type == "first_chore").count();
        assert_eq!(first_chore_count, 1);
    }

    #[test]
    fn test_check_and_award_idempotent() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );
        let chore_id = chore.id.unwrap();
        let user_id = user.id.unwrap();
        let admin_id = admin.id.unwrap();

        let today = NaiveDate::from_ymd_opt(2026, 4, 15).unwrap();
        setup_approved_completion(&context, chore_id, user_id, admin_id, today);

        // Call twice — should not duplicate
        BadgeSvc::check_and_award(&context, user_id);
        BadgeSvc::check_and_award(&context, user_id);

        use crate::schema::user_badges;
        let conn = &mut context.pool.get().unwrap();
        let badges: Vec<UserBadge> = user_badges::table
            .filter(user_badges::user_id.eq(user_id))
            .load(conn)
            .unwrap();
        let first_chore_count = badges.iter().filter(|b| b.badge_type == "first_chore").count();
        assert_eq!(first_chore_count, 1);
    }

    #[test]
    fn test_five_day_streak_false_with_gaps() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );
        let chore_id = chore.id.unwrap();
        let user_id = user.id.unwrap();
        let admin_id = admin.id.unwrap();

        ChoreSvc::assign_user(&context, chore_id, user_id).unwrap();

        // Create completions on non-consecutive days (days 1, 2, 3, 5, 6 — gap at 4)
        for day in [1u32, 2, 3, 5, 6] {
            let date = NaiveDate::from_ymd_opt(2026, 4, day).unwrap();
            let input = ChoreCompletionInput {
                uuid: None,
                chore_id,
                user_id,
                completed_date: date,
            };
            let c = ChoreCompletionSvc::create(&context, &input).unwrap();
            ChoreCompletionSvc::approve(&context, &c.uuid, admin_id).unwrap();
        }

        let result = BadgeSvc::check_five_day_streak_pub(&context, user_id);
        assert!(!result.unwrap(), "Should not have a 5-day streak with gaps");
    }

    #[test]
    fn test_five_day_streak_true_with_consecutive_days() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );
        let chore_id = chore.id.unwrap();
        let user_id = user.id.unwrap();
        let admin_id = admin.id.unwrap();

        ChoreSvc::assign_user(&context, chore_id, user_id).unwrap();

        // Create completions on 5 consecutive days
        for day in [1u32, 2, 3, 4, 5] {
            let date = NaiveDate::from_ymd_opt(2026, 4, day).unwrap();
            let input = ChoreCompletionInput {
                uuid: None,
                chore_id,
                user_id,
                completed_date: date,
            };
            let c = ChoreCompletionSvc::create(&context, &input).unwrap();
            ChoreCompletionSvc::approve(&context, &c.uuid, admin_id).unwrap();
        }

        let result = BadgeSvc::check_five_day_streak_pub(&context, user_id);
        assert!(result.unwrap(), "Should have a 5-day streak");
    }

    #[test]
    fn test_earnings_badge_ten_dollars() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        // 200 cents per completion, need 5 to reach $10
        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            200,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );
        let chore_id = chore.id.unwrap();
        let user_id = user.id.unwrap();
        let admin_id = admin.id.unwrap();

        ChoreSvc::assign_user(&context, chore_id, user_id).unwrap();

        for day in [1u32, 2, 3, 4, 5] {
            let date = NaiveDate::from_ymd_opt(2026, 4, day).unwrap();
            let input = ChoreCompletionInput {
                uuid: None,
                chore_id,
                user_id,
                completed_date: date,
            };
            let c = ChoreCompletionSvc::create(&context, &input).unwrap();
            ChoreCompletionSvc::approve(&context, &c.uuid, admin_id).unwrap();
        }

        BadgeSvc::check_and_award(&context, user_id);

        use crate::schema::user_badges;
        let conn = &mut context.pool.get().unwrap();
        let badges: Vec<UserBadge> = user_badges::table
            .filter(user_badges::user_id.eq(user_id))
            .load(conn)
            .unwrap();
        let ten_dollar_count = badges
            .iter()
            .filter(|b| b.badge_type == "ten_dollars_earned")
            .count();
        assert_eq!(ten_dollar_count, 1, "Should have ten_dollars_earned badge");
    }

    #[test]
    fn test_perfect_week_badge() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        // Chore assigned Mon only (required_days = 1)
        let chore = create_test_chore(
            &context,
            "Monday Chore",
            PaymentType::Daily,
            100,
            day_patterns::monday_only(),
            admin.id.unwrap(),
        );
        let chore_id = chore.id.unwrap();
        let user_id = user.id.unwrap();
        let admin_id = admin.id.unwrap();

        // April 14, 2026 is a Monday
        let monday = NaiveDate::from_ymd_opt(2026, 4, 14).unwrap();
        setup_approved_completion(&context, chore_id, user_id, admin_id, monday);

        BadgeSvc::check_and_award(&context, user_id);

        use crate::schema::user_badges;
        let conn = &mut context.pool.get().unwrap();
        let badges: Vec<UserBadge> = user_badges::table
            .filter(user_badges::user_id.eq(user_id))
            .load(conn)
            .unwrap();
        let perfect_week_count = badges
            .iter()
            .filter(|b| b.badge_type == "perfect_week")
            .count();
        assert_eq!(perfect_week_count, 1, "Should have perfect_week badge");
    }
}
