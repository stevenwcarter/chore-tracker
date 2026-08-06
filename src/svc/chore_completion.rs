#![allow(clippy::too_many_arguments)]
use crate::{
    availability::AvailabilityWindow,
    context::GraphQLContext,
    db::get_conn,
    models::{Chore, ChoreCompletion, ChoreCompletionInput, PaymentType, User},
    schema::{chore_completions, chores, users},
    svc::{BadgeSvc, ChoreSvc},
};
use anyhow::{Context, Result};
use chrono::{NaiveDate, Utc};
use diesel::prelude::*;
use juniper::GraphQLInputObject;

/// Predicates for [`ChoreCompletionSvc::list`]. Every field is optional and all supplied
/// ones are AND-ed together.
///
/// The boolean flags are tri-state in name only: `None` and `Some(false)` both mean "do not
/// filter on this", so only `Some(true)` narrows the result. Setting both `unpaid_only` and
/// `paid_only` therefore asks for rows that are paid and unpaid at once, and returns none.
///
/// `limit` defaults to 100 and is capped at `MAX_COMPLETION_LIMIT`; `offset` defaults to 0.
#[derive(Debug, Copy, Clone, Default, GraphQLInputObject)]
pub struct ChoreCompletionFilter {
    pub user_id: Option<i32>,
    pub chore_id: Option<i32>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
    pub approved_only: Option<bool>,
    pub unpaid_only: Option<bool>,
    pub paid_only: Option<bool>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

pub struct ChoreCompletionSvc {}

impl ChoreCompletionSvc {
    pub fn get(context: &GraphQLContext, completion_uuid: &str) -> Result<ChoreCompletion> {
        chore_completions::table
            .filter(chore_completions::uuid.eq(completion_uuid))
            .select(ChoreCompletion::as_select())
            .first(&mut get_conn(context)?)
            .context("Could not find chore completion")
    }

    const MAX_COMPLETION_LIMIT: i32 = 1000;

    pub fn list(
        context: &GraphQLContext,
        filter: &ChoreCompletionFilter,
    ) -> Result<Vec<ChoreCompletion>> {
        let limit: i64 = filter
            .limit
            .unwrap_or(100)
            .min(Self::MAX_COMPLETION_LIMIT)
            .into();
        let offset: i64 = filter.offset.unwrap_or_default().into();

        let mut query = chore_completions::table.into_boxed();

        // Filter: target user / chore / date range
        if let Some(user_id) = filter.user_id {
            query = query.filter(chore_completions::user_id.eq(user_id));
        }

        if let Some(chore_id) = filter.chore_id {
            query = query.filter(chore_completions::chore_id.eq(chore_id));
        }

        if let Some(date_from) = filter.date_from {
            query = query.filter(chore_completions::completed_date.ge(date_from));
        }

        if let Some(date_to) = filter.date_to {
            query = query.filter(chore_completions::completed_date.le(date_to));
        }

        // Filter: approval and payment status
        if filter.approved_only == Some(true) {
            query = query.filter(chore_completions::approved.eq(true));
        }

        if filter.unpaid_only == Some(true) {
            query = query.filter(chore_completions::paid_out.eq(false));
        }

        if filter.paid_only == Some(true) {
            query = query.filter(chore_completions::paid_out.eq(true));
        }

        query
            .select(ChoreCompletion::as_select())
            .order_by(chore_completions::completed_date.desc())
            .limit(limit)
            .offset(offset)
            .load::<ChoreCompletion>(&mut get_conn(context)?)
            .context("Could not load chore completions")
    }

    /// Shared loader for weekly completion queries; pass `user_id = Some(id)` to
    /// filter to a single user, or `None` to load all users' completions for the week.
    fn load_weekly(
        context: &GraphQLContext,
        week_start_date: NaiveDate,
        user_id: Option<i32>,
    ) -> Result<Vec<ChoreCompletion>> {
        let week_end_date = week_start_date + chrono::Duration::days(6);
        let mut conn = get_conn(context)?;

        let mut query = chore_completions::table
            .filter(chore_completions::completed_date.between(week_start_date, week_end_date))
            .select(ChoreCompletion::as_select())
            .order_by(chore_completions::completed_date.asc())
            .into_boxed();

        if let Some(uid) = user_id {
            query = query.filter(chore_completions::user_id.eq(uid));
        }

        query
            .load(&mut conn)
            .context("Could not load weekly chore completions")
    }

    /// One user's completions over the inclusive 7-day window
    /// `week_start_date ..= week_start_date + 6`, ordered ascending by completed date.
    ///
    /// Which weekday a week starts on is the caller's choice, not this function's; the
    /// frontend passes a Sunday.
    pub fn get_weekly_view(
        context: &GraphQLContext,
        user_id: i32,
        week_start_date: NaiveDate,
    ) -> Result<Vec<ChoreCompletion>> {
        Self::load_weekly(context, week_start_date, Some(user_id))
    }

    /// The all-users variant of [`Self::get_weekly_view`], over the same inclusive 7-day
    /// window. The weekly grid uses it to grey out chores a sibling has already claimed.
    pub fn get_all_weekly_completions(
        context: &GraphQLContext,
        week_start_date: NaiveDate,
    ) -> Result<Vec<ChoreCompletion>> {
        Self::load_weekly(context, week_start_date, None)
    }

    /// Totals what is owed to each user, summing only completions that are approved and not
    /// yet paid out.
    ///
    /// The LEFT JOIN deliberately keeps users who have no completions at all, reporting them
    /// with a total of 0 so they still show up on the payout screen. A user whose completions
    /// have *all* been paid out matches neither arm of the filter and drops out of the result
    /// entirely.
    pub fn get_unpaid_totals(context: &GraphQLContext) -> Result<Vec<(User, i32)>> {
        let results: Vec<(User, Option<i64>)> = users::table
            .left_join(chore_completions::table)
            .filter(
                // Include users with no completions (LEFT JOIN null case, detected via id),
                // or users who have at least one approved, unpaid completion.
                chore_completions::id
                    .is_null()
                    .or(chore_completions::approved
                        .eq(true)
                        .and(chore_completions::paid_out.eq(false))),
            )
            .group_by(users::id)
            .select((
                User::as_select(),
                diesel::dsl::sum(chore_completions::amount_cents).nullable(),
            ))
            .load(&mut get_conn(context)?)
            .context("Could not load unpaid totals")?;

        let converted_results = results
            .into_iter()
            .map(|(user, total)| (user, i32::try_from(total.unwrap_or(0)).unwrap_or(i32::MAX)))
            .collect();

        Ok(converted_results)
    }

    /// Per-user totals of money earned but not yet received: every completion with
    /// `paid_out = false`, **regardless of approval status**.
    ///
    /// This is deliberately not `get_unpaid_totals`. That one is the payout screen's
    /// query - approved *and* unpaid, with a LEFT JOIN that keeps zero-owed users
    /// visible. This one answers the kid's "what have I earned so far" question, so
    /// work still awaiting an admin's approval counts.
    ///
    /// Paid-out completions are excluded because that money has already moved into
    /// the kid's YNAB balance, which the landing page shows alongside this figure -
    /// counting it in both places would double it. A user with nothing pending is
    /// absent from the result rather than present with a zero.
    pub fn get_pending_totals(context: &GraphQLContext) -> Result<Vec<(User, i32)>> {
        let results: Vec<(User, Option<i64>)> = users::table
            .inner_join(chore_completions::table)
            .filter(chore_completions::paid_out.eq(false))
            .group_by(users::id)
            .select((
                User::as_select(),
                diesel::dsl::sum(chore_completions::amount_cents).nullable(),
            ))
            .load(&mut get_conn(context)?)
            .context("Could not load pending totals")?;

        Ok(results
            .into_iter()
            .map(|(user, total)| (user, i32::try_from(total.unwrap_or(0)).unwrap_or(i32::MAX)))
            .collect())
    }

    /// Creates a completion for `completion_input`, computing its payout from the chore's
    /// payment type and enforcing the bonus-chore claim cap.
    ///
    /// The chore fetch, cap check, insert and re-read all share one pooled connection inside a
    /// transaction, instead of each taking (and releasing) its own connection as before. That
    /// closes the previous check-then-insert window on capped bonus chores: a competing claim
    /// on the same chore can no longer commit its own insert between this call's cap check and
    /// its insert, because SQLite serializes commits against any connection still mid-transaction.
    pub fn create(
        context: &GraphQLContext,
        completion_input: &ChoreCompletionInput,
    ) -> Result<ChoreCompletion> {
        let mut conn = get_conn(context)?;

        conn.transaction(|conn| {
            let chore = chores::table
                .filter(chores::id.eq(completion_input.chore_id))
                .select(Chore::as_select())
                .first(conn)
                .context("Could not find chore by ID")?;

            ensure_bonus_claim_allowed(&chore, conn)?;
            ensure_within_availability_window(&chore, completion_input.completed_date)?;

            let payment_type = PaymentType::from(chore.payment_type);
            let amount_cents = PaymentType::calculate_completion_amount(
                &payment_type,
                chore.amount_cents,
                chore.required_days,
            );
            let completion = new_completion(completion_input, amount_cents);

            diesel::insert_into(chore_completions::table)
                .values(&completion)
                .execute(conn)
                .context("Could not create chore completion")?;

            chore_completions::table
                .filter(chore_completions::uuid.eq(&completion.uuid))
                .select(ChoreCompletion::as_select())
                .first(conn)
                .context("Could not find chore completion")
        })
    }

    /// Approves a completion, stamping `approved_by_admin_id` and `approved_at`, which is
    /// what makes it eligible for payout.
    ///
    /// Also re-runs the badge checks for the owning user; a failure there is swallowed rather
    /// than failing the approval.
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
            .execute(&mut get_conn(context)?)
            .context("Could not approve chore completion")?;

        let completion = Self::get(context, completion_uuid)?;
        BadgeSvc::check_and_award(context, completion.user_id);
        Ok(completion)
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
            .execute(&mut get_conn(context)?)
            .context("Could not mark completions as paid")?;

        Ok(())
    }

    /// Marks all approved, unpaid completions for the given users as paid in a single query.
    pub fn mark_as_paid_batch(context: &GraphQLContext, user_ids: &[i32]) -> Result<()> {
        diesel::update(chore_completions::table)
            .filter(chore_completions::approved.eq(true))
            .filter(chore_completions::paid_out.eq(false))
            .filter(chore_completions::user_id.eq_any(user_ids))
            .set((
                chore_completions::paid_out.eq(true),
                chore_completions::paid_out_at.eq(Utc::now().naive_utc()),
            ))
            .execute(&mut get_conn(context)?)
            .context("Could not mark completions as paid")?;

        Ok(())
    }

    pub fn delete(context: &GraphQLContext, completion_uuid: &str) -> Result<()> {
        diesel::delete(chore_completions::table)
            .filter(chore_completions::uuid.eq(completion_uuid))
            .execute(&mut get_conn(context)?)
            .context("Could not delete chore completion")?;

        Ok(())
    }
}

/// Bails if `chore` is a bonus chore that has already reached its claim cap, sharing the
/// caller's connection so the check runs inside the same transaction as the insert.
fn ensure_bonus_claim_allowed(chore: &Chore, conn: &mut SqliteConnection) -> Result<()> {
    if chore.bonus_date.is_some() && !ChoreSvc::can_claim_bonus_for(chore, conn)? {
        anyhow::bail!("Bonus chore has reached its claim limit");
    }
    Ok(())
}

/// Rejects a completion dated outside the chore's yearly availability window.
///
/// This is the enforcement point for seasonal chores. The weekly grid also hides
/// out-of-season days, but that is a UI affordance - correctness lives here, so a
/// future frontend change cannot silently remove the guarantee.
fn ensure_within_availability_window(chore: &Chore, completed_date: NaiveDate) -> Result<()> {
    let window = AvailabilityWindow::from_columns(chore.available_start, chore.available_end)?;

    match window {
        Some(window) if !window.contains(completed_date) => {
            anyhow::bail!(
                "'{}' is not available on {completed_date}; it runs {}/{} to {}/{}",
                chore.name,
                window.start().month(),
                window.start().day(),
                window.end().month(),
                window.end().day(),
            )
        }
        _ => Ok(()),
    }
}

/// Builds the completion row to insert; `amount_cents` is the already-computed payout.
fn new_completion(input: &ChoreCompletionInput, amount_cents: i32) -> ChoreCompletion {
    ChoreCompletion {
        id: None,
        uuid: crate::uuid_or_generate(input.uuid.clone()),
        chore_id: input.chore_id,
        user_id: input.user_id,
        completed_date: input.completed_date,
        amount_cents,
        approved: false,
        approved_by_admin_id: None,
        approved_at: None,
        paid_out: false,
        paid_out_at: None,
        created_at: None,
        updated_at: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        models::{Chore, ChoreCompletionInput, ChoreInput, PaymentType},
        test_helpers::test_db::{
            create_test_admin, create_test_chore, create_test_chore_assignment,
            create_test_context, create_test_date, create_test_user, day_patterns,
        },
    };

    /// Builds a same-day completion input for `user` against `chore`. Bonus chores must be
    /// completed on their `bonus_date`, so this reuses it when present; other chores get an
    /// arbitrary fixed date since `calculate_completion_amount` never looks at the date.
    fn completion_input(chore: &Chore, user: &User) -> ChoreCompletionInput {
        ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: chore
                .bonus_date
                .unwrap_or_else(|| create_test_date(2024, 10, 21)),
        }
    }

    /// Creates a bonus chore due today (a fixed test date) capped at `max_claims` claims.
    fn create_bonus_chore_for_test(
        context: &GraphQLContext,
        admin_id: i32,
        max_claims: i32,
    ) -> Chore {
        let chore_input = ChoreInput {
            uuid: None,
            name: "Bonus chore".to_owned(),
            description: None,
            payment_type: PaymentType::Daily,
            amount_cents: 300,
            required_days: 0,
            active: Some(true),
            created_by_admin_id: admin_id,
            bonus_date: Some(create_test_date(2026, 4, 15)),
            max_claims: Some(max_claims),
            availability_window: None,
        };
        ChoreSvc::create(context, &Chore::try_from(chore_input).unwrap()).unwrap()
    }

    #[test]
    fn create_computes_daily_amount_unchanged() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Parent", "p@example.com");
        let user = create_test_user(&context, "Kid");
        let chore = create_test_chore(
            &context,
            "Dishes",
            PaymentType::Daily,
            150,
            day_patterns::mon_wed_fri(),
            admin.id.unwrap(),
        );

        let completion =
            ChoreCompletionSvc::create(&context, &completion_input(&chore, &user)).unwrap();
        assert_eq!(
            completion.amount_cents, 150,
            "daily chores pay the full amount per completion"
        );
    }

    #[test]
    fn create_computes_weekly_split_unchanged() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Parent", "p@example.com");
        let user = create_test_user(&context, "Kid");
        // 150 cents over Mon/Wed/Fri == 3 days == 50/day.
        let chore = create_test_chore(
            &context,
            "Trash",
            PaymentType::Weekly,
            150,
            day_patterns::mon_wed_fri(),
            admin.id.unwrap(),
        );

        let completion =
            ChoreCompletionSvc::create(&context, &completion_input(&chore, &user)).unwrap();
        assert_eq!(
            completion.amount_cents, 50,
            "weekly chores split across assigned days"
        );
    }

    #[test]
    fn create_rejects_a_bonus_claim_past_the_cap() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Parent", "p@example.com");
        let user = create_test_user(&context, "Kid");
        let chore =
            create_bonus_chore_for_test(&context, admin.id.unwrap(), /* max_claims */ 1);

        ChoreCompletionSvc::create(&context, &completion_input(&chore, &user)).unwrap();
        let second = ChoreCompletionSvc::create(&context, &completion_input(&chore, &user));

        assert!(
            second.is_err(),
            "second claim must be rejected once max_claims is reached"
        );
    }

    #[test]
    fn test_weekly_chore_payout_should_pay_fraction_per_day() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        // Create a weekly chore with Monday+Wednesday+Friday (3 days), paying 150 cents
        let chore = create_test_chore(
            &context,
            "Weekly Chore",
            PaymentType::Weekly,
            150,                         // 150 cents total
            day_patterns::mon_wed_fri(), // 3 days
            admin.id.unwrap(),
        );

        // Assign chore to user
        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        // Create completion for Monday
        let monday_input = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: create_test_date(2024, 10, 21), // A Monday
        };

        let monday_completion = ChoreCompletionSvc::create(&context, &monday_input).unwrap();

        // Expected: 150 / 3 = 50 cents per day
        assert_eq!(
            monday_completion.amount_cents, 50,
            "Weekly chore should pay fraction of total amount per day"
        );

        // Create completion for Wednesday
        let wednesday_input = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: create_test_date(2024, 10, 23), // A Wednesday
        };

        let wednesday_completion = ChoreCompletionSvc::create(&context, &wednesday_input).unwrap();
        assert_eq!(wednesday_completion.amount_cents, 50);

        // Create completion for Friday
        let friday_input = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: create_test_date(2024, 10, 25), // A Friday
        };

        let friday_completion = ChoreCompletionSvc::create(&context, &friday_input).unwrap();
        assert_eq!(friday_completion.amount_cents, 50);

        // Approve all completions to test unpaid totals
        ChoreCompletionSvc::approve(&context, &monday_completion.uuid, admin.id.unwrap()).unwrap();
        ChoreCompletionSvc::approve(&context, &wednesday_completion.uuid, admin.id.unwrap())
            .unwrap();
        ChoreCompletionSvc::approve(&context, &friday_completion.uuid, admin.id.unwrap()).unwrap();

        // Check unpaid totals - should be 150 total (50 + 50 + 50)
        let unpaid_totals = ChoreCompletionSvc::get_unpaid_totals(&context).unwrap();
        let user_total = unpaid_totals.iter().find(|(u, _)| u.id == user.id).unwrap();
        assert_eq!(user_total.1, 150, "Total unpaid should be 150 cents");
    }

    #[test]
    fn test_weekly_chore_payout_with_rounding() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        // Create a weekly chore with weekdays (5 days), paying 150 cents
        // 150 / 5 = 30, which should round to 25 (nearest quarter)
        let chore = create_test_chore(
            &context,
            "Weekly Rounding Chore",
            PaymentType::Weekly,
            150,                      // 150 cents total
            day_patterns::weekdays(), // 5 days (Mon-Fri)
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        let monday_input = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: create_test_date(2024, 10, 21), // A Monday
        };

        let completion = ChoreCompletionSvc::create(&context, &monday_input).unwrap();

        // Expected: 150 / 5 = 30, rounded to nearest quarter = 25
        assert_eq!(
            completion.amount_cents, 25,
            "Amount should be rounded to nearest quarter (25 cents)"
        );
    }

    #[test]
    fn test_daily_chore_payout_should_pay_for_each_completion() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        // Create a daily chore paying 200 cents per completion
        let chore = create_test_chore(
            &context,
            "Daily Chore",
            PaymentType::Daily,
            200,                       // 200 cents per completion
            day_patterns::every_day(), // Can be done every day
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        // Create multiple completions
        let dates = [
            create_test_date(2024, 10, 21), // Monday
            create_test_date(2024, 10, 22), // Tuesday
            create_test_date(2024, 10, 23), // Wednesday
        ];

        for date in dates {
            let input = ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: date,
            };

            let completion = ChoreCompletionSvc::create(&context, &input).unwrap();
            assert_eq!(
                completion.amount_cents, 200,
                "Daily chore should pay full amount for each completion"
            );

            // Approve the completion
            ChoreCompletionSvc::approve(&context, &completion.uuid, admin.id.unwrap()).unwrap();
        }

        // Check unpaid totals - should be 600 total (200 * 3)
        let unpaid_totals = ChoreCompletionSvc::get_unpaid_totals(&context).unwrap();
        let user_total = unpaid_totals.iter().find(|(u, _)| u.id == user.id).unwrap();
        assert_eq!(user_total.1, 600, "Total unpaid should be 600 cents");
    }

    #[test]
    fn test_chore_completion_crud_operations() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::monday_only(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        // Test creation
        let input = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: create_test_date(2024, 10, 21),
        };

        let completion = ChoreCompletionSvc::create(&context, &input).unwrap();
        assert_eq!(completion.chore_id, chore.id.unwrap());
        assert_eq!(completion.user_id, user.id.unwrap());
        assert_eq!(completion.amount_cents, 100);
        assert!(!completion.approved);
        assert!(!completion.paid_out);

        // Test get by UUID
        let retrieved = ChoreCompletionSvc::get(&context, &completion.uuid).unwrap();
        assert_eq!(retrieved.uuid, completion.uuid);

        // Test approval
        let approved =
            ChoreCompletionSvc::approve(&context, &completion.uuid, admin.id.unwrap()).unwrap();
        assert!(approved.approved);
        assert_eq!(approved.approved_by_admin_id, Some(admin.id.unwrap()));
        assert!(approved.approved_at.is_some());

        // Test marking as paid
        ChoreCompletionSvc::mark_as_paid(&context, Some(user.id.unwrap())).unwrap();
        let paid_completion = ChoreCompletionSvc::get(&context, &completion.uuid).unwrap();
        assert!(paid_completion.paid_out);
        assert!(paid_completion.paid_out_at.is_some());

        // Test deletion
        ChoreCompletionSvc::delete(&context, &completion.uuid).unwrap();
        let deleted_result = ChoreCompletionSvc::get(&context, &completion.uuid);
        assert!(deleted_result.is_err());
    }

    #[test]
    fn test_list_completions_with_filters() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");

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
            PaymentType::Daily,
            200,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore1.id.unwrap(), user1.id.unwrap());
        create_test_chore_assignment(&context, chore2.id.unwrap(), user2.id.unwrap());

        // Create multiple completions
        let inputs = [
            (
                chore1.id.unwrap(),
                user1.id.unwrap(),
                create_test_date(2024, 10, 21),
            ),
            (
                chore1.id.unwrap(),
                user1.id.unwrap(),
                create_test_date(2024, 10, 22),
            ),
            (
                chore2.id.unwrap(),
                user2.id.unwrap(),
                create_test_date(2024, 10, 21),
            ),
        ];

        let mut completion_uuids = Vec::new();
        for (chore_id, user_id, date) in inputs {
            let input = ChoreCompletionInput {
                uuid: None,
                chore_id,
                user_id,
                completed_date: date,
            };
            let completion = ChoreCompletionSvc::create(&context, &input).unwrap();
            completion_uuids.push(completion.uuid);
        }

        // Approve first completion only
        ChoreCompletionSvc::approve(&context, &completion_uuids[0], admin.id.unwrap()).unwrap();

        let filter = ChoreCompletionFilter::default();

        // Test listing all completions
        let all_completions = ChoreCompletionSvc::list(&context, &filter).unwrap();
        assert_eq!(all_completions.len(), 3);

        let mut filter = ChoreCompletionFilter::default();
        filter.user_id = Some(user1.id.unwrap());

        // Test filtering by user
        let user1_completions = ChoreCompletionSvc::list(&context, &filter).unwrap();
        assert_eq!(user1_completions.len(), 2);

        let mut filter = ChoreCompletionFilter::default();
        filter.chore_id = Some(chore1.id.unwrap());

        // Test filtering by chore
        let chore1_completions = ChoreCompletionSvc::list(&context, &filter).unwrap();
        assert_eq!(chore1_completions.len(), 2);

        let mut filter = ChoreCompletionFilter::default();
        filter.approved_only = Some(true);

        // Test filtering by approved only
        let approved_completions = ChoreCompletionSvc::list(&context, &filter).unwrap();
        assert_eq!(approved_completions.len(), 1);

        let mut filter = ChoreCompletionFilter::default();
        filter.date_from = Some(create_test_date(2024, 10, 21));
        filter.date_to = Some(create_test_date(2024, 10, 21));

        // Test date filtering
        let date_filtered = ChoreCompletionSvc::list(&context, &filter).unwrap();
        assert_eq!(date_filtered.len(), 2); // Both completions on 10/21
    }

    #[test]
    fn test_weekly_view() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let chore = create_test_chore(
            &context,
            "Weekly View Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        // Create completions for a specific week
        let week_start = create_test_date(2024, 10, 21); // A Monday
        let dates_in_week = [
            week_start,                             // Monday
            week_start + chrono::Duration::days(2), // Wednesday
            week_start + chrono::Duration::days(4), // Friday
        ];

        // Create completion outside the week for comparison
        let outside_week_input = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: week_start + chrono::Duration::days(10), // Following week
        };
        ChoreCompletionSvc::create(&context, &outside_week_input).unwrap();

        // Create completions within the week
        for date in dates_in_week {
            let input = ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: date,
            };
            ChoreCompletionSvc::create(&context, &input).unwrap();
        }

        // Test weekly view
        let weekly_completions =
            ChoreCompletionSvc::get_weekly_view(&context, user.id.unwrap(), week_start).unwrap();

        assert_eq!(
            weekly_completions.len(),
            3,
            "Should only return completions from the specified week"
        );

        // Verify dates are in ascending order
        for i in 1..weekly_completions.len() {
            assert!(
                weekly_completions[i - 1].completed_date <= weekly_completions[i].completed_date,
                "Completions should be ordered by date ascending"
            );
        }
    }

    #[test]
    fn test_payment_type_calculations() {
        // Test daily payment calculation
        let daily_amount = PaymentType::calculate_completion_amount(
            &PaymentType::Daily,
            200,
            day_patterns::every_day(),
        );
        assert_eq!(daily_amount, 200, "Daily chores should pay full amount");

        // Test weekly payment calculation with 3 days
        let weekly_amount_3_days = PaymentType::calculate_completion_amount(
            &PaymentType::Weekly,
            150,
            day_patterns::mon_wed_fri(),
        );
        assert_eq!(
            weekly_amount_3_days, 50,
            "Weekly chore with 3 days should pay 50 cents each"
        );

        // Test weekly payment calculation with 5 days (rounding case)
        let weekly_amount_5_days = PaymentType::calculate_completion_amount(
            &PaymentType::Weekly,
            150,
            day_patterns::weekdays(),
        );
        assert_eq!(
            weekly_amount_5_days, 25,
            "Weekly chore with 5 days should round 30 to 25 cents"
        );

        // Test edge case: no assigned days
        let no_days_amount = PaymentType::calculate_completion_amount(&PaymentType::Weekly, 100, 0);
        assert_eq!(
            no_days_amount, 100,
            "No assigned days should fallback to full amount"
        );
    }

    #[test]
    fn test_create_completion_blocked_when_bonus_cap_reached() {
        use crate::models::{Chore, ChoreInput, PaymentType};
        use crate::svc::ChoreSvc;
        use chrono::NaiveDate;

        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");

        let today = NaiveDate::from_ymd_opt(2026, 4, 15).unwrap();

        // Create a bonus chore with max_claims = 1
        let chore_input = ChoreInput {
            uuid: None,
            name: "Single-claim bonus".to_string(),
            description: None,
            payment_type: PaymentType::Daily,
            amount_cents: 300,
            required_days: 0,
            active: Some(true),
            created_by_admin_id: admin.id.unwrap(),
            bonus_date: Some(today),
            max_claims: Some(1),
            availability_window: None,
        };
        let chore_raw = Chore::try_from(chore_input).unwrap();
        let chore = ChoreSvc::create(&context, &chore_raw).unwrap();
        let chore_id = chore.id.unwrap();

        // Assign both users to the chore
        ChoreSvc::assign_user(&context, chore_id, user1.id.unwrap()).unwrap();
        ChoreSvc::assign_user(&context, chore_id, user2.id.unwrap()).unwrap();

        // First user claims it — should succeed
        let input1 = ChoreCompletionInput {
            uuid: None,
            chore_id,
            user_id: user1.id.unwrap(),
            completed_date: today,
        };
        let result1 = ChoreCompletionSvc::create(&context, &input1);
        assert!(result1.is_ok(), "First claim should succeed");

        // Second user tries to claim — should fail
        let input2 = ChoreCompletionInput {
            uuid: None,
            chore_id,
            user_id: user2.id.unwrap(),
            completed_date: today,
        };
        let result2 = ChoreCompletionSvc::create(&context, &input2);
        assert!(result2.is_err(), "Second claim should be blocked by cap");
        let err_msg = result2.unwrap_err().to_string();
        assert!(
            err_msg.contains("claim limit"),
            "Error should mention claim limit, got: {}",
            err_msg
        );
    }

    #[test]
    fn test_rounding_to_nearest_quarter() {
        // Test various rounding scenarios
        assert_eq!(PaymentType::round_to_nearest_quarter(23.0), 25);
        assert_eq!(PaymentType::round_to_nearest_quarter(27.0), 25);
        assert_eq!(PaymentType::round_to_nearest_quarter(37.0), 25);
        assert_eq!(PaymentType::round_to_nearest_quarter(38.0), 50);
        assert_eq!(PaymentType::round_to_nearest_quarter(12.0), 0);
        assert_eq!(PaymentType::round_to_nearest_quarter(13.0), 25);
        assert_eq!(PaymentType::round_to_nearest_quarter(87.0), 75);
        assert_eq!(PaymentType::round_to_nearest_quarter(88.0), 100);
    }

    #[test]
    fn test_get_assigned_days_count() {
        assert_eq!(
            PaymentType::get_assigned_days_count(day_patterns::mon_wed_fri()),
            3
        );
        assert_eq!(
            PaymentType::get_assigned_days_count(day_patterns::weekdays()),
            5
        );
        assert_eq!(
            PaymentType::get_assigned_days_count(day_patterns::every_day()),
            7
        );
        assert_eq!(
            PaymentType::get_assigned_days_count(day_patterns::monday_only()),
            1
        );
        assert_eq!(PaymentType::get_assigned_days_count(0), 0);
    }

    #[test]
    fn test_get_all_weekly_completions() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");

        let chore = create_test_chore(
            &context,
            "Weekly Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user1.id.unwrap());
        create_test_chore_assignment(&context, chore.id.unwrap(), user2.id.unwrap());

        let week_start = create_test_date(2024, 10, 21); // A Monday

        // Create completions for both users in the same week
        let inputs = [
            (user1.id.unwrap(), week_start),
            (user1.id.unwrap(), week_start + chrono::Duration::days(2)), // Wednesday
            (user2.id.unwrap(), week_start + chrono::Duration::days(1)), // Tuesday
            (user2.id.unwrap(), week_start + chrono::Duration::days(10)), // Following week (should not appear)
        ];

        for (user_id, date) in inputs {
            let input = ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id,
                completed_date: date,
            };
            ChoreCompletionSvc::create(&context, &input).unwrap();
        }

        let all_weekly =
            ChoreCompletionSvc::get_all_weekly_completions(&context, week_start).unwrap();

        assert_eq!(
            all_weekly.len(),
            3,
            "Should return completions from all users for the week"
        );

        // Verify all completions are within the week
        let week_end = week_start + chrono::Duration::days(6);
        for completion in &all_weekly {
            assert!(
                completion.completed_date >= week_start && completion.completed_date <= week_end,
                "All completions should be within the specified week"
            );
        }
    }

    /// Creates a chore whose availability window runs Sep 1 - Jun 15 (a school year,
    /// so the window wraps the new year).
    fn create_school_year_chore(context: &GraphQLContext, admin_id: i32) -> Chore {
        use crate::models::AvailabilityWindowInput;

        let input = ChoreInput {
            uuid: None,
            name: "Study spelling".to_owned(),
            description: None,
            payment_type: PaymentType::Daily,
            amount_cents: 100,
            required_days: 0,
            active: Some(true),
            created_by_admin_id: admin_id,
            bonus_date: None,
            max_claims: None,
            availability_window: Some(AvailabilityWindowInput {
                start_month: 9,
                start_day: 1,
                end_month: 6,
                end_day: 15,
            }),
        };
        ChoreSvc::create(context, &Chore::try_from(input).unwrap()).unwrap()
    }

    #[test]
    fn create_rejects_a_completion_outside_the_availability_window() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_school_year_chore(&context, admin.id.unwrap());

        let result = ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: NaiveDate::from_ymd_opt(2026, 7, 4).unwrap(), // summer
            },
        );

        assert!(result.is_err(), "July 4 is outside a Sep 1 - Jun 15 window");
    }

    #[test]
    fn create_accepts_a_completion_inside_the_availability_window() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_school_year_chore(&context, admin.id.unwrap());

        let result = ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: NaiveDate::from_ymd_opt(2026, 10, 20).unwrap(),
            },
        );

        assert!(
            result.is_ok(),
            "October 20 is inside a Sep 1 - Jun 15 window"
        );
    }

    #[test]
    fn create_accepts_completions_on_both_window_boundaries() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_school_year_chore(&context, admin.id.unwrap());

        for (label, day) in [
            (
                "start boundary",
                NaiveDate::from_ymd_opt(2026, 9, 1).unwrap(),
            ),
            (
                "end boundary",
                NaiveDate::from_ymd_opt(2027, 6, 15).unwrap(),
            ),
        ] {
            let result = ChoreCompletionSvc::create(
                &context,
                &ChoreCompletionInput {
                    uuid: None,
                    chore_id: chore.id.unwrap(),
                    user_id: user.id.unwrap(),
                    completed_date: day,
                },
            );
            assert!(result.is_ok(), "{label} must be inclusive");
        }
    }

    #[test]
    fn create_accepts_any_date_for_a_chore_with_no_window() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_test_chore(
            &context,
            "Year round",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        let result = ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: NaiveDate::from_ymd_opt(2026, 7, 4).unwrap(),
            },
        );

        assert!(result.is_ok(), "a windowless chore is never out of season");
    }

    /// Pins the decision that a season never changes the weekly per-day rate: the
    /// season only removes *days* from the week, it never changes the *rate* paid
    /// for the days that remain in season. That rate is
    /// `amount_cents / required-day-count`, subject to the pre-existing
    /// quarter-rounding pinned by `test_weekly_chore_payout_with_rounding` - this
    /// test deliberately uses rounding-neutral inputs (500 / 5 = 100, already a
    /// multiple of 25) so its assertions aren't coupled to that unrelated rounding
    /// rule.
    ///
    /// The load-bearing check is the equality assertion between the seasonal and
    /// windowless completions: two otherwise-identical Weekly chores, one with a
    /// Sep 1 - Jun 17 window (cut short mid-week) and one with no window at all,
    /// must pay the same amount for the same in-season day. A future proration
    /// change must break that assertion deliberately.
    #[test]
    fn weekly_rate_ignores_the_availability_window() {
        use crate::models::AvailabilityWindowInput;

        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let seasonal_input = ChoreInput {
            uuid: None,
            name: "Weekly seasonal".to_owned(),
            description: None,
            payment_type: PaymentType::Weekly,
            amount_cents: 500,
            required_days: day_patterns::weekdays(), // 5 days -> 100 cents each
            active: Some(true),
            created_by_admin_id: admin.id.unwrap(),
            bonus_date: None,
            max_claims: None,
            availability_window: Some(AvailabilityWindowInput {
                start_month: 9,
                start_day: 1,
                end_month: 6,
                end_day: 17, // window ends mid-week
            }),
        };
        let seasonal_chore =
            ChoreSvc::create(&context, &Chore::try_from(seasonal_input).unwrap()).unwrap();

        let year_round_input = ChoreInput {
            uuid: None,
            name: "Weekly year round".to_owned(),
            description: None,
            payment_type: PaymentType::Weekly,
            amount_cents: 500,
            required_days: day_patterns::weekdays(),
            active: Some(true),
            created_by_admin_id: admin.id.unwrap(),
            bonus_date: None,
            max_claims: None,
            availability_window: None,
        };
        let year_round_chore =
            ChoreSvc::create(&context, &Chore::try_from(year_round_input).unwrap()).unwrap();

        // Wednesday 2026-06-17 is the final in-season day of the seasonal chore's week.
        let completed_date = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();

        let seasonal_completion = ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: seasonal_chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date,
            },
        )
        .unwrap();

        let year_round_completion = ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: year_round_chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date,
            },
        )
        .unwrap();

        assert_eq!(
            seasonal_completion.amount_cents, year_round_completion.amount_cents,
            "a season-shortened week must pay the same per-day rate as a year-round week"
        );
        assert_eq!(seasonal_completion.amount_cents, 100);
        assert_eq!(year_round_completion.amount_cents, 100);
    }

    #[test]
    fn test_unpaid_totals_calculation() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");

        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user1.id.unwrap());
        create_test_chore_assignment(&context, chore.id.unwrap(), user2.id.unwrap());

        // Create and approve completions for user1
        let user1_input1 = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user1.id.unwrap(),
            completed_date: create_test_date(2024, 10, 21),
        };
        let user1_completion1 = ChoreCompletionSvc::create(&context, &user1_input1).unwrap();
        ChoreCompletionSvc::approve(&context, &user1_completion1.uuid, admin.id.unwrap()).unwrap();

        let user1_input2 = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user1.id.unwrap(),
            completed_date: create_test_date(2024, 10, 22),
        };
        let user1_completion2 = ChoreCompletionSvc::create(&context, &user1_input2).unwrap();
        ChoreCompletionSvc::approve(&context, &user1_completion2.uuid, admin.id.unwrap()).unwrap();

        // Create unapproved completion for user1 (should not count)
        let user1_input3 = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user1.id.unwrap(),
            completed_date: create_test_date(2024, 10, 23),
        };
        ChoreCompletionSvc::create(&context, &user1_input3).unwrap(); // Not approved

        // Create and approve one completion for user2
        let user2_input = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user2.id.unwrap(),
            completed_date: create_test_date(2024, 10, 21),
        };
        let user2_completion = ChoreCompletionSvc::create(&context, &user2_input).unwrap();
        ChoreCompletionSvc::approve(&context, &user2_completion.uuid, admin.id.unwrap()).unwrap();

        // Get unpaid totals before marking any as paid
        let unpaid_totals_before = ChoreCompletionSvc::get_unpaid_totals(&context).unwrap();

        // Find totals for users who have completions
        let user1_total_before = unpaid_totals_before
            .iter()
            .find(|(u, _)| u.id == user1.id)
            .map(|(_, total)| *total);
        let user2_total_before = unpaid_totals_before
            .iter()
            .find(|(u, _)| u.id == user2.id)
            .map(|(_, total)| *total);

        // User1 should have 200 (two approved completions)
        assert_eq!(
            user1_total_before,
            Some(200),
            "User1 should have 200 unpaid before marking as paid"
        );

        // User2 should have 100 (one approved completion)
        assert_eq!(
            user2_total_before,
            Some(100),
            "User2 should have 100 unpaid"
        );

        // Mark user1's completions as paid
        ChoreCompletionSvc::mark_as_paid(&context, Some(user1.id.unwrap())).unwrap();

        let unpaid_totals_after = ChoreCompletionSvc::get_unpaid_totals(&context).unwrap();

        // Find totals for each user after marking as paid
        let user1_total_after = unpaid_totals_after
            .iter()
            .find(|(u, _)| u.id == user1.id)
            .map(|(_, total)| *total);
        let user2_total_after = unpaid_totals_after
            .iter()
            .find(|(u, _)| u.id == user2.id)
            .map(|(_, total)| *total);

        // Note: The get_unpaid_totals function may not include users with 0 unpaid amounts
        // depending on the SQL query logic. User1 might not be in the results at all if they have 0 unpaid.
        // This is acceptable behavior as the function is meant to show users who have unpaid amounts.
        if let Some(total) = user1_total_after {
            assert_eq!(total, 0, "User1 should have 0 unpaid (marked as paid)");
        }

        // User2 should still have 100 (one approved, unpaid completion)
        assert_eq!(
            user2_total_after,
            Some(100),
            "User2 should still have 100 unpaid"
        );
    }

    /// Pending = completed but not paid out, regardless of approval. Approval is the
    /// admin's gate on *payout*, not on whether the kid has done the work, so an
    /// unapproved completion still shows in the kid's pending figure.
    #[test]
    fn pending_totals_count_unapproved_and_approved_but_not_paid_out() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_test_chore(
            &context,
            "Make bed",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        // Unapproved.
        ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: NaiveDate::from_ymd_opt(2026, 5, 4).unwrap(),
            },
        )
        .unwrap();

        // Approved but not paid out.
        let approved = ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: NaiveDate::from_ymd_opt(2026, 5, 5).unwrap(),
            },
        )
        .unwrap();
        ChoreCompletionSvc::approve(&context, &approved.uuid, admin.id.unwrap()).unwrap();

        let totals = ChoreCompletionSvc::get_pending_totals(&context).unwrap();
        let (_, amount) = totals
            .iter()
            .find(|(u, _)| u.id == user.id)
            .expect("user has pending work");

        assert_eq!(*amount, 200, "both completions count");
    }

    #[test]
    fn pending_totals_exclude_paid_out_completions() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");
        let chore = create_test_chore(
            &context,
            "Make bed",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        let completion = ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: NaiveDate::from_ymd_opt(2026, 5, 4).unwrap(),
            },
        )
        .unwrap();
        ChoreCompletionSvc::approve(&context, &completion.uuid, admin.id.unwrap()).unwrap();
        ChoreCompletionSvc::mark_as_paid(&context, Some(user.id.unwrap())).unwrap();

        let totals = ChoreCompletionSvc::get_pending_totals(&context).unwrap();
        let entry = totals.iter().find(|(u, _)| u.id == user.id);

        assert!(
            entry.is_none() || entry.unwrap().1 == 0,
            "paid-out money has moved to the YNAB balance and must not be counted twice"
        );
    }

    #[test]
    fn pending_totals_keep_users_separate() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let alice = create_test_user(&context, "Alice");
        let bob = create_test_user(&context, "Bob");
        let chore = create_test_chore(
            &context,
            "Make bed",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        for (user_id, count) in [(alice.id.unwrap(), 2), (bob.id.unwrap(), 1)] {
            for day in 0..count {
                ChoreCompletionSvc::create(
                    &context,
                    &ChoreCompletionInput {
                        uuid: None,
                        chore_id: chore.id.unwrap(),
                        user_id,
                        completed_date: NaiveDate::from_ymd_opt(2026, 5, 4 + day).unwrap(),
                    },
                )
                .unwrap();
            }
        }

        let totals = ChoreCompletionSvc::get_pending_totals(&context).unwrap();
        assert_eq!(
            totals.iter().find(|(u, _)| u.id == alice.id).unwrap().1,
            200
        );
        assert_eq!(totals.iter().find(|(u, _)| u.id == bob.id).unwrap().1, 100);
    }

    #[test]
    fn pending_totals_omit_a_user_with_no_completions() {
        let context = create_test_context();
        let user = create_test_user(&context, "Idle User");

        let totals = ChoreCompletionSvc::get_pending_totals(&context).unwrap();
        assert!(
            totals.iter().all(|(u, _)| u.id != user.id),
            "a user with nothing pending is absent; the client reads that as zero"
        );
    }
}
