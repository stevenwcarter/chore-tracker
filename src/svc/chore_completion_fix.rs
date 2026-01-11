use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{ChoreCompletion, PaymentType},
    schema::{chore_completions, chores},
};
use anyhow::{Context, Result};
use diesel::prelude::*;
use std::collections::HashMap;

pub struct ChoreCompletionFixSvc {}

impl ChoreCompletionFixSvc {
    /// Fixes all weekly chore completions to use the correct fractional payment amounts.
    /// This function:
    /// 1. Finds all chore completions for weekly chores
    /// 2. Recalculates the correct fractional amount for each completion
    /// 3. Updates the completion records with the corrected amounts
    ///
    /// Returns the number of records updated.
    pub fn fix_weekly_completion_amounts(context: &GraphQLContext) -> Result<i32> {
        let mut conn = get_conn(context);

        // Get all chore completions that are for weekly chores
        let weekly_completions: Vec<(ChoreCompletion, String, i32, i32)> = chore_completions::table
            .inner_join(
                chores::table.on(chore_completions::chore_id.eq(chores::id.assume_not_null())),
            )
            .filter(chores::payment_type.eq("weekly"))
            .select((
                ChoreCompletion::as_select(),
                chores::payment_type,
                chores::amount_cents,
                chores::required_days,
            ))
            .load(&mut conn)
            .context("Failed to load weekly chore completions")?;

        let mut updated_count = 0;

        for (completion, payment_type_str, chore_amount_cents, required_days) in weekly_completions
        {
            let payment_type = PaymentType::from(payment_type_str.as_str());

            // Calculate the correct fractional amount
            let correct_amount = PaymentType::calculate_completion_amount(
                &payment_type,
                chore_amount_cents,
                required_days,
            );

            // Only update if the amount is different (to avoid unnecessary updates)
            if completion.amount_cents != correct_amount {
                diesel::update(chore_completions::table)
                    .filter(chore_completions::id.eq(completion.id))
                    .set(chore_completions::amount_cents.eq(correct_amount))
                    .execute(&mut conn)
                    .with_context(|| {
                        format!(
                            "Failed to update completion {} from {} to {} cents",
                            completion.uuid, completion.amount_cents, correct_amount
                        )
                    })?;

                updated_count += 1;

                tracing::info!(
                    "Updated completion {} for chore_id {} from {} to {} cents",
                    completion.uuid,
                    completion.chore_id,
                    completion.amount_cents,
                    correct_amount
                );
            }
        }

        tracing::info!(
            "Weekly chore completion amount fix completed. Updated {} records.",
            updated_count
        );

        Ok(updated_count)
    }

    /// Gets a summary of weekly chore completions that need fixing.
    /// Returns a list of (chore_id, completion_count, current_total_cents, expected_total_cents)
    pub fn analyze_weekly_completion_amounts(
        context: &GraphQLContext,
    ) -> Result<Vec<(i32, i64, i64, i64)>> {
        let mut conn = get_conn(context);

        // Get all weekly completions with their chore details
        let weekly_completions: Vec<(i32, i32, i32, i32)> = chore_completions::table
            .inner_join(
                chores::table.on(chore_completions::chore_id.eq(chores::id.assume_not_null())),
            )
            .filter(chores::payment_type.eq("weekly"))
            .select((
                chore_completions::chore_id,
                chore_completions::amount_cents,
                chores::amount_cents,
                chores::required_days,
            ))
            .load(&mut conn)
            .context("Failed to analyze weekly chore completions")?;

        // Group and analyze in Rust rather than SQL to avoid complex Diesel grouping issues
        let mut analysis_map: HashMap<i32, (i64, i64, i32, i32)> = HashMap::new();

        for (chore_id, completion_amount, chore_amount, required_days) in weekly_completions {
            let entry = analysis_map
                .entry(chore_id)
                .or_insert((0, 0, chore_amount, required_days));
            entry.0 += 1; // completion count
            entry.1 += completion_amount as i64; // current total
        }

        let mut results = Vec::new();

        for (chore_id, (completion_count, current_total, chore_amount_cents, required_days)) in
            analysis_map
        {
            // Calculate what the total should be
            let payment_type = PaymentType::Weekly;
            let correct_per_completion = PaymentType::calculate_completion_amount(
                &payment_type,
                chore_amount_cents,
                required_days,
            );
            let expected_total = (correct_per_completion as i64) * completion_count;

            results.push((chore_id, completion_count, current_total, expected_total));
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        svc::ChoreCompletionSvc,
        test_helpers::test_db::{
            create_test_admin, create_test_chore, create_test_chore_assignment,
            create_test_context, create_test_date, create_test_user, day_patterns,
        },
    };
    use diesel::QueryDsl;

    /// Helper function to manually create a chore completion with a specific amount
    /// (bypassing the automatic calculation in ChoreCompletionSvc::create)
    fn create_manual_completion(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
        amount_cents: i32,
        date: chrono::NaiveDate,
    ) -> ChoreCompletion {
        use crate::schema::chore_completions;
        use uuid::Uuid;

        let completion = ChoreCompletion {
            id: None,
            uuid: Uuid::now_v7().to_string(),
            chore_id,
            user_id,
            completed_date: date,
            amount_cents, // Manually set amount
            approved: false,
            approved_by_admin_id: None,
            approved_at: None,
            paid_out: false,
            paid_out_at: None,
            created_at: None,
            updated_at: None,
        };

        diesel::insert_into(chore_completions::table)
            .values(&completion)
            .execute(&mut context.pool.get().unwrap())
            .unwrap();

        chore_completions::table
            .filter(chore_completions::uuid.eq(&completion.uuid))
            .select(ChoreCompletion::as_select())
            .first(&mut context.pool.get().unwrap())
            .unwrap()
    }

    #[test]
    fn test_fix_weekly_completion_amounts_basic() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        // Create a weekly chore with 150 cents total, assigned to 3 days (Mon+Wed+Fri)
        // Expected per-completion amount: 150 / 3 = 50 cents
        let chore = create_test_chore(
            &context,
            "Weekly Chore",
            PaymentType::Weekly,
            150,
            day_patterns::mon_wed_fri(), // 3 days
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        // Create completions with INCORRECT amounts (simulating old buggy behavior)
        let completion1 = create_manual_completion(
            &context,
            chore.id.unwrap(),
            user.id.unwrap(),
            150, // Wrong: should be 50
            create_test_date(2024, 10, 21),
        );

        let completion2 = create_manual_completion(
            &context,
            chore.id.unwrap(),
            user.id.unwrap(),
            75, // Wrong: should be 50
            create_test_date(2024, 10, 23),
        );

        let completion3 = create_manual_completion(
            &context,
            chore.id.unwrap(),
            user.id.unwrap(),
            50, // Correct: should remain 50
            create_test_date(2024, 10, 25),
        );

        // Run the fix
        let updated_count = ChoreCompletionFixSvc::fix_weekly_completion_amounts(&context).unwrap();

        // Should have updated 2 completions (the incorrect ones)
        assert_eq!(updated_count, 2);

        // Verify the amounts were corrected
        let fixed_completion1 = ChoreCompletionSvc::get(&context, &completion1.uuid).unwrap();
        let fixed_completion2 = ChoreCompletionSvc::get(&context, &completion2.uuid).unwrap();
        let fixed_completion3 = ChoreCompletionSvc::get(&context, &completion3.uuid).unwrap();

        assert_eq!(fixed_completion1.amount_cents, 50);
        assert_eq!(fixed_completion2.amount_cents, 50);
        assert_eq!(fixed_completion3.amount_cents, 50); // Should remain unchanged
    }

    #[test]
    fn test_fix_ignores_daily_chores() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        // Create a daily chore
        let daily_chore = create_test_chore(
            &context,
            "Daily Chore",
            PaymentType::Daily,
            200,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        // Create a weekly chore
        let weekly_chore = create_test_chore(
            &context,
            "Weekly Chore",
            PaymentType::Weekly,
            150,
            day_patterns::mon_wed_fri(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, daily_chore.id.unwrap(), user.id.unwrap());
        create_test_chore_assignment(&context, weekly_chore.id.unwrap(), user.id.unwrap());

        // Create completions with amounts that would be "wrong" if treated as weekly
        let _daily_completion = create_manual_completion(
            &context,
            daily_chore.id.unwrap(),
            user.id.unwrap(),
            999, // Any amount - should be ignored by fix
            create_test_date(2024, 10, 21),
        );

        let _weekly_completion = create_manual_completion(
            &context,
            weekly_chore.id.unwrap(),
            user.id.unwrap(),
            100, // Wrong amount for weekly (should be 50)
            create_test_date(2024, 10, 21),
        );

        // Run the fix
        let updated_count = ChoreCompletionFixSvc::fix_weekly_completion_amounts(&context).unwrap();

        // Should only update the weekly completion, not the daily one
        assert_eq!(updated_count, 1);
    }

    #[test]
    fn test_fix_with_no_changes_needed() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let chore = create_test_chore(
            &context,
            "Weekly Chore",
            PaymentType::Weekly,
            120,
            day_patterns::weekdays(), // 5 days, 120/5 = 24, rounds to 25
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        // Create completions that already have the correct amounts
        let _completion1 = create_manual_completion(
            &context,
            chore.id.unwrap(),
            user.id.unwrap(),
            25, // Correct amount
            create_test_date(2024, 10, 21),
        );

        let _completion2 = create_manual_completion(
            &context,
            chore.id.unwrap(),
            user.id.unwrap(),
            25, // Correct amount
            create_test_date(2024, 10, 22),
        );

        // Run the fix
        let updated_count = ChoreCompletionFixSvc::fix_weekly_completion_amounts(&context).unwrap();

        // Should update nothing since amounts are already correct
        assert_eq!(updated_count, 0);
    }

    #[test]
    fn test_analyze_weekly_completion_amounts() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        // Create two weekly chores with different configurations
        let chore1 = create_test_chore(
            &context,
            "Weekly Chore 1",
            PaymentType::Weekly,
            150,
            day_patterns::mon_wed_fri(), // 3 days, expected: 50 cents each
            admin.id.unwrap(),
        );

        let chore2 = create_test_chore(
            &context,
            "Weekly Chore 2",
            PaymentType::Weekly,
            100,
            day_patterns::weekdays(), // 5 days, expected: 25 cents each (100/5 = 20, rounds to 25)
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore1.id.unwrap(), user.id.unwrap());
        create_test_chore_assignment(&context, chore2.id.unwrap(), user.id.unwrap());

        // Create completions with mixed correct/incorrect amounts

        // Chore 1 completions (expected 50 each, total should be 150 for 3 completions)
        let _completion1 = create_manual_completion(
            &context,
            chore1.id.unwrap(),
            user.id.unwrap(),
            150, // Wrong (should be 50)
            create_test_date(2024, 10, 21),
        );

        let _completion2 = create_manual_completion(
            &context,
            chore1.id.unwrap(),
            user.id.unwrap(),
            50, // Correct
            create_test_date(2024, 10, 23),
        );

        let _completion3 = create_manual_completion(
            &context,
            chore1.id.unwrap(),
            user.id.unwrap(),
            25, // Wrong (should be 50)
            create_test_date(2024, 10, 25),
        );

        // Chore 2 completions (expected 20 each, total should be 40 for 2 completions)
        let _completion4 = create_manual_completion(
            &context,
            chore2.id.unwrap(),
            user.id.unwrap(),
            30, // Wrong (should be 20)
            create_test_date(2024, 10, 21),
        );

        let _completion5 = create_manual_completion(
            &context,
            chore2.id.unwrap(),
            user.id.unwrap(),
            20, // Correct
            create_test_date(2024, 10, 22),
        );

        // Analyze the amounts
        let analysis = ChoreCompletionFixSvc::analyze_weekly_completion_amounts(&context).unwrap();

        // Should return analysis for both chores
        assert_eq!(analysis.len(), 2);

        // Sort by chore_id for predictable testing
        let mut analysis = analysis;
        analysis.sort_by_key(|&(chore_id, _, _, _)| chore_id);

        let (chore1_id, chore1_count, chore1_current, chore1_expected) = analysis[0];
        let (chore2_id, chore2_count, chore2_current, chore2_expected) = analysis[1];

        // Chore 1 analysis
        assert_eq!(chore1_id, chore1.id.unwrap());
        assert_eq!(chore1_count, 3); // 3 completions
        assert_eq!(chore1_current, 225); // 150 + 50 + 25 = 225
        assert_eq!(chore1_expected, 150); // 50 * 3 = 150

        // Chore 2 analysis
        assert_eq!(chore2_id, chore2.id.unwrap());
        assert_eq!(chore2_count, 2); // 2 completions
        assert_eq!(chore2_current, 50); // 30 + 20 = 50
        assert_eq!(chore2_expected, 50); // 25 * 2 = 50 (100/5 = 20, rounds to 25)
    }

    #[test]
    fn test_analyze_with_no_weekly_chores() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        // Create only daily chores
        let daily_chore = create_test_chore(
            &context,
            "Daily Chore",
            PaymentType::Daily,
            200,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, daily_chore.id.unwrap(), user.id.unwrap());

        // Create some daily completions
        let _completion = create_manual_completion(
            &context,
            daily_chore.id.unwrap(),
            user.id.unwrap(),
            200,
            create_test_date(2024, 10, 21),
        );

        // Analyze should return empty since no weekly chores
        let analysis = ChoreCompletionFixSvc::analyze_weekly_completion_amounts(&context).unwrap();
        assert_eq!(analysis.len(), 0);
    }

    #[test]
    fn test_fix_and_analyze_integration() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let chore = create_test_chore(
            &context,
            "Weekly Chore",
            PaymentType::Weekly,
            150,                         // Changed from 180 to 150
            day_patterns::mon_wed_fri(), // 3 days, expected: 50 cents each (150/3 = 50)
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        // Create completions with wrong amounts
        let _completion1 = create_manual_completion(
            &context,
            chore.id.unwrap(),
            user.id.unwrap(),
            180, // Wrong
            create_test_date(2024, 10, 21),
        );

        let _completion2 = create_manual_completion(
            &context,
            chore.id.unwrap(),
            user.id.unwrap(),
            90, // Wrong
            create_test_date(2024, 10, 23),
        );

        // Analyze before fix
        let analysis_before =
            ChoreCompletionFixSvc::analyze_weekly_completion_amounts(&context).unwrap();
        assert_eq!(analysis_before.len(), 1);
        let (_, count_before, current_before, expected_before) = analysis_before[0];
        assert_eq!(count_before, 2);
        assert_eq!(current_before, 270); // 180 + 90
        assert_eq!(expected_before, 100); // 50 * 2 (150 cents / 3 days = 50 cents each)

        // Apply fix
        let updated_count = ChoreCompletionFixSvc::fix_weekly_completion_amounts(&context).unwrap();
        assert_eq!(updated_count, 2);

        // Analyze after fix
        let analysis_after =
            ChoreCompletionFixSvc::analyze_weekly_completion_amounts(&context).unwrap();
        assert_eq!(analysis_after.len(), 1);
        let (_, count_after, current_after, expected_after) = analysis_after[0];
        assert_eq!(count_after, 2);
        assert_eq!(current_after, 100); // Now matches expected (50 * 2)
        assert_eq!(expected_after, 100);
        assert_eq!(current_after, expected_after); // Should now be equal
    }

    #[test]
    fn test_fix_with_complex_day_patterns() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        // Test with single day (Monday only)
        let single_day_chore = create_test_chore(
            &context,
            "Monday Only Chore",
            PaymentType::Weekly,
            100,
            day_patterns::monday_only(), // 1 day, expected: 100 cents
            admin.id.unwrap(),
        );

        // Test with all 7 days
        let every_day_chore = create_test_chore(
            &context,
            "Every Day Chore",
            PaymentType::Weekly,
            175,
            day_patterns::every_day(), // 7 days, expected: 25 cents each (175/7=25)
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, single_day_chore.id.unwrap(), user.id.unwrap());
        create_test_chore_assignment(&context, every_day_chore.id.unwrap(), user.id.unwrap());

        // Create completions with wrong amounts
        let _single_completion = create_manual_completion(
            &context,
            single_day_chore.id.unwrap(),
            user.id.unwrap(),
            50, // Wrong (should be 100)
            create_test_date(2024, 10, 21),
        );

        let _every_day_completion = create_manual_completion(
            &context,
            every_day_chore.id.unwrap(),
            user.id.unwrap(),
            175, // Wrong (should be 25)
            create_test_date(2024, 10, 21),
        );

        // Fix and verify
        let updated_count = ChoreCompletionFixSvc::fix_weekly_completion_amounts(&context).unwrap();
        assert_eq!(updated_count, 2);

        // Analyze after fix to verify correct amounts
        let analysis = ChoreCompletionFixSvc::analyze_weekly_completion_amounts(&context).unwrap();
        assert_eq!(analysis.len(), 2);

        // Find each chore in the analysis
        let single_day_analysis = analysis
            .iter()
            .find(|&&(chore_id, _, _, _)| chore_id == single_day_chore.id.unwrap())
            .unwrap();
        let every_day_analysis = analysis
            .iter()
            .find(|&&(chore_id, _, _, _)| chore_id == every_day_chore.id.unwrap())
            .unwrap();

        // Verify single day chore: 100 cents for 1 completion
        assert_eq!(single_day_analysis.2, 100); // current total
        assert_eq!(single_day_analysis.3, 100); // expected total

        // Verify every day chore: 25 cents for 1 completion
        assert_eq!(every_day_analysis.2, 25); // current total
        assert_eq!(every_day_analysis.3, 25); // expected total
    }
}
