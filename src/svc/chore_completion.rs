#![allow(clippy::too_many_arguments)]
use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{ChoreCompletion, User},
    schema::{chore_completions, users},
};
use anyhow::{Context, Result};
use chrono::{NaiveDate, Utc};
use diesel::prelude::*;

pub struct ChoreCompletionSvc {}

impl ChoreCompletionSvc {
    pub fn get(context: &GraphQLContext, completion_uuid: &str) -> Result<ChoreCompletion> {
        chore_completions::table
            .filter(chore_completions::uuid.eq(completion_uuid))
            .select(ChoreCompletion::as_select())
            .first(&mut get_conn(context))
            .context("Could not find chore completion")
    }

    pub fn list(
        context: &GraphQLContext,
        user_id: Option<i32>,
        chore_id: Option<i32>,
        date_from: Option<NaiveDate>,
        date_to: Option<NaiveDate>,
        approved_only: Option<bool>,
        unpaid_only: Option<bool>,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<ChoreCompletion>> {
        let limit: i64 = limit.into();
        let offset: i64 = offset.into();

        let mut query = chore_completions::table.into_boxed();

        if let Some(user_id) = user_id {
            query = query.filter(chore_completions::user_id.eq(user_id));
        }

        if let Some(chore_id) = chore_id {
            query = query.filter(chore_completions::chore_id.eq(chore_id));
        }

        if let Some(date_from) = date_from {
            query = query.filter(chore_completions::completed_date.ge(date_from));
        }

        if let Some(date_to) = date_to {
            query = query.filter(chore_completions::completed_date.le(date_to));
        }

        if let Some(true) = approved_only {
            query = query.filter(chore_completions::approved.eq(true));
        }

        if let Some(true) = unpaid_only {
            query = query.filter(chore_completions::paid_out.eq(false));
        }

        query
            .select(ChoreCompletion::as_select())
            .order_by(chore_completions::completed_date.desc())
            .limit(limit)
            .offset(offset)
            .load::<ChoreCompletion>(&mut get_conn(context))
            .context("Could not load chore completions")
    }

    pub fn get_weekly_view(
        context: &GraphQLContext,
        user_id: i32,
        week_start_date: NaiveDate,
    ) -> Result<Vec<ChoreCompletion>> {
        let week_end_date = week_start_date + chrono::Duration::days(6);

        chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::completed_date.between(week_start_date, week_end_date))
            .select(ChoreCompletion::as_select())
            .order_by(chore_completions::completed_date.asc())
            .load(&mut get_conn(context))
            .context("Could not load weekly chore completions")
    }

    pub fn get_all_weekly_completions(
        context: &GraphQLContext,
        week_start_date: NaiveDate,
    ) -> Result<Vec<ChoreCompletion>> {
        let week_end_date = week_start_date + chrono::Duration::days(6);

        chore_completions::table
            .filter(chore_completions::completed_date.between(week_start_date, week_end_date))
            .select(ChoreCompletion::as_select())
            .order_by(chore_completions::completed_date.asc())
            .load(&mut get_conn(context))
            .context("Could not load all weekly chore completions")
    }

    pub fn get_unpaid_totals(context: &GraphQLContext) -> Result<Vec<(User, i32)>> {
        let results: Vec<(User, Option<i64>)> = users::table
            .left_join(chore_completions::table)
            .filter(
                chore_completions::approved
                    .eq(true)
                    .or(chore_completions::approved.is_null()),
            )
            .filter(
                chore_completions::paid_out
                    .eq(false)
                    .or(chore_completions::paid_out.is_null()),
            )
            .group_by(users::id)
            .select((
                User::as_select(),
                diesel::dsl::sum(chore_completions::amount_cents).nullable(),
            ))
            .load(&mut get_conn(context))
            .context("Could not load unpaid totals")?;

        let converted_results = results
            .into_iter()
            .map(|(user, total)| (user, total.unwrap_or(0) as i32))
            .collect();

        Ok(converted_results)
    }

    pub fn create(
        context: &GraphQLContext,
        completion: &ChoreCompletion,
    ) -> Result<ChoreCompletion> {
        diesel::insert_into(chore_completions::table)
            .values(completion)
            .execute(&mut get_conn(context))
            .context("Could not create chore completion")?;

        Self::get(context, &completion.uuid)
    }

    pub fn approve(
        context: &GraphQLContext,
        completion_uuid: &str,
        admin_id: i32,
    ) -> Result<ChoreCompletion> {
        diesel::update(chore_completions::table)
            .filter(chore_completions::uuid.eq(completion_uuid))
            .set((
                chore_completions::approved.eq(true),
                chore_completions::approved_by_admin_id.eq(admin_id),
                chore_completions::approved_at.eq(Utc::now().naive_utc()),
            ))
            .execute(&mut get_conn(context))
            .context("Could not approve chore completion")?;

        Self::get(context, completion_uuid)
    }

    pub fn mark_as_paid(context: &GraphQLContext, user_id: Option<i32>) -> Result<()> {
        let mut query = diesel::update(chore_completions::table).into_boxed();

        query = query
            .filter(chore_completions::approved.eq(true))
            .filter(chore_completions::paid_out.eq(false));

        if let Some(user_id) = user_id {
            query = query.filter(chore_completions::user_id.eq(user_id));
        }

        query
            .set((
                chore_completions::paid_out.eq(true),
                chore_completions::paid_out_at.eq(Utc::now().naive_utc()),
            ))
            .execute(&mut get_conn(context))
            .context("Could not mark completions as paid")?;

        Ok(())
    }

    pub fn delete(context: &GraphQLContext, completion_uuid: &str) -> Result<()> {
        diesel::delete(chore_completions::table)
            .filter(chore_completions::uuid.eq(completion_uuid))
            .execute(&mut get_conn(context))
            .context("Could not delete chore completion")?;

        Ok(())
    }
}

