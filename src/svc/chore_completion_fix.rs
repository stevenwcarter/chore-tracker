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
            .inner_join(chores::table.on(chore_completions::chore_id.eq(chores::id.assume_not_null())))
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
        
        for (completion, payment_type_str, chore_amount_cents, required_days) in weekly_completions {
            let payment_type = PaymentType::from(payment_type_str);
            
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
            .inner_join(chores::table.on(chore_completions::chore_id.eq(chores::id.assume_not_null())))
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
            let entry = analysis_map.entry(chore_id).or_insert((0, 0, chore_amount, required_days));
            entry.0 += 1; // completion count
            entry.1 += completion_amount as i64; // current total
        }
        
        let mut results = Vec::new();
        
        for (chore_id, (completion_count, current_total, chore_amount_cents, required_days)) in analysis_map {
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