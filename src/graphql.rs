#![allow(clippy::too_many_arguments)]
use chrono::NaiveDate;
use juniper::{EmptySubscription, FieldError, FieldResult, RootNode};
use tracing::error;

use crate::{
    context::GraphQLContext,
    models::{
        Admin, AdminInput, Chore, ChoreCompletion, ChoreCompletionInput, ChoreCompletionNote,
        ChoreCompletionNoteInput, ChoreInput, UnpaidTotal, User, UserBadge, UserInput,
    },
    svc::{
        AdminSvc, ChoreCompletionNoteSvc, ChoreCompletionSvc, ChoreSvc, UserSvc,
        chore_completion::ChoreCompletionFilter, user::UserBalance,
    },
};

const DEFAULT_LIST_LIMIT: i32 = 100;
const DEFAULT_LIST_OFFSET: i32 = 0;

/// GraphQL query root: all read operations are implemented here.
pub struct Query;

#[juniper::graphql_object(context = GraphQLContext)]
impl Query {
    // Users
    pub async fn get_user(context: &GraphQLContext, user_uuid: String) -> FieldResult<User> {
        graphql_translate_anyhow(UserSvc::get(context, &user_uuid))
    }

    pub fn list_users(
        context: &GraphQLContext,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> FieldResult<Vec<User>> {
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT);
        let offset = offset.unwrap_or(DEFAULT_LIST_OFFSET);
        graphql_translate_anyhow(UserSvc::list(context, limit, offset))
    }

    pub async fn get_balances(context: &GraphQLContext) -> FieldResult<Vec<UserBalance>> {
        graphql_translate_anyhow(UserSvc::balances(context).await)
    }

    // Admins
    pub async fn get_admin(context: &GraphQLContext, admin_uuid: String) -> FieldResult<Admin> {
        graphql_translate_anyhow(AdminSvc::get(context, &admin_uuid))
    }

    pub fn list_admins(
        context: &GraphQLContext,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> FieldResult<Vec<Admin>> {
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT);
        let offset = offset.unwrap_or(DEFAULT_LIST_OFFSET);
        graphql_translate_anyhow(AdminSvc::list(context, limit, offset))
    }

    // Chores
    pub async fn get_chore(context: &GraphQLContext, chore_uuid: String) -> FieldResult<Chore> {
        graphql_translate_anyhow(ChoreSvc::get(context, &chore_uuid))
    }

    pub fn list_chores(
        context: &GraphQLContext,
        user_id: Option<i32>,
        active_only: Option<bool>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> FieldResult<Vec<Chore>> {
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT);
        let offset = offset.unwrap_or(DEFAULT_LIST_OFFSET);
        let active_only = active_only.unwrap_or(true);
        graphql_translate_anyhow(ChoreSvc::list(context, user_id, active_only, limit, offset))
    }

    pub fn list_bonus_chores(context: &GraphQLContext, date: NaiveDate) -> FieldResult<Vec<Chore>> {
        graphql_translate_anyhow(ChoreSvc::list_bonus_chores(context, date))
    }

    // Chore Completions
    pub async fn get_chore_completion(
        context: &GraphQLContext,
        completion_uuid: String,
    ) -> FieldResult<ChoreCompletion> {
        graphql_translate_anyhow(ChoreCompletionSvc::get(context, &completion_uuid))
    }

    pub fn list_chore_completions(
        context: &GraphQLContext,
        filter: ChoreCompletionFilter,
    ) -> FieldResult<Vec<ChoreCompletion>> {
        graphql_translate_anyhow(ChoreCompletionSvc::list(context, &filter))
    }

    /// One user's completions over the inclusive 7-day window
    /// `week_start_date ..= week_start_date + 6`. The caller picks which weekday a week
    /// starts on; the frontend passes a Sunday.
    pub fn get_weekly_chore_completions(
        context: &GraphQLContext,
        user_id: i32,
        week_start_date: NaiveDate,
    ) -> FieldResult<Vec<ChoreCompletion>> {
        graphql_translate_anyhow(ChoreCompletionSvc::get_weekly_view(
            context,
            user_id,
            week_start_date,
        ))
    }

    /// The unfiltered sibling of `getWeeklyChoreCompletions`: the same 7-day window across
    /// every user. The weekly grid uses it to show which chores a sibling has already claimed.
    pub fn get_all_weekly_completions(
        context: &GraphQLContext,
        week_start_date: NaiveDate,
    ) -> FieldResult<Vec<ChoreCompletion>> {
        graphql_translate_anyhow(ChoreCompletionSvc::get_all_weekly_completions(
            context,
            week_start_date,
        ))
    }

    /// Amount owed to each user, counting only completions that are approved but not yet
    /// paid out. A user with nothing owed may come back with a total of 0 or be omitted
    /// entirely, depending on whether they have any completions at all.
    pub fn get_unpaid_totals(context: &GraphQLContext) -> FieldResult<Vec<UnpaidTotal>> {
        let results = ChoreCompletionSvc::get_unpaid_totals(context)?;
        let unpaid_totals = results
            .into_iter()
            .map(|(user, amount)| UnpaidTotal::new(user, amount))
            .collect();
        Ok(unpaid_totals)
    }

    // Chore Completion Notes
    pub fn list_chore_completion_notes(
        context: &GraphQLContext,
        completion_id: i32,
        visible_to_user_only: Option<bool>,
    ) -> FieldResult<Vec<ChoreCompletionNote>> {
        let visible_to_user_only = visible_to_user_only.unwrap_or(false);
        graphql_translate_anyhow(ChoreCompletionNoteSvc::list_for_completion(
            context,
            completion_id,
            visible_to_user_only,
        ))
    }

    // Badges
    /// Every badge a user has earned, read straight from the `user_badges` table rather than
    /// through the service layer. This query only reads: badges are awarded as a side effect
    /// of approving a chore completion.
    pub fn user_badges(context: &GraphQLContext, user_id: i32) -> FieldResult<Vec<UserBadge>> {
        use crate::schema::user_badges::dsl;
        use diesel::prelude::*;
        graphql_translate_anyhow(context.pool.get().map_err(anyhow::Error::from).and_then(
            |mut conn| {
                dsl::user_badges
                    .filter(dsl::user_id.eq(user_id))
                    .load::<UserBadge>(&mut conn)
                    .map_err(anyhow::Error::from)
            },
        ))
    }
}

/// GraphQL mutation root: all write operations are implemented here.
pub struct Mutation;

#[juniper::graphql_object(context = GraphQLContext)]
impl Mutation {
    // Users
    pub async fn create_user(context: &GraphQLContext, user: UserInput) -> FieldResult<User> {
        context.require_admin()?;
        graphql_translate_anyhow(UserSvc::create(context, &user.into()))
    }

    pub async fn update_user(context: &GraphQLContext, user: UserInput) -> FieldResult<User> {
        context.require_admin()?;
        graphql_translate_anyhow(UserSvc::update(context, &user.into()))
    }

    pub async fn delete_user(context: &GraphQLContext, user_uuid: String) -> FieldResult<bool> {
        context.require_admin()?;
        graphql_translate_anyhow(UserSvc::delete(context, &user_uuid))?;
        Ok(true)
    }

    // Admins
    pub async fn create_admin(context: &GraphQLContext, admin: AdminInput) -> FieldResult<Admin> {
        context.require_admin()?;
        graphql_translate_anyhow(AdminSvc::create(context, &admin.into()))
    }

    pub async fn update_admin(context: &GraphQLContext, admin: AdminInput) -> FieldResult<Admin> {
        context.require_admin()?;
        graphql_translate_anyhow(AdminSvc::update(context, &admin.into()))
    }

    // Chores
    pub async fn create_chore(context: &GraphQLContext, chore: ChoreInput) -> FieldResult<Chore> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreSvc::create(context, &chore.into()))
    }

    pub async fn create_bonus_chore(
        context: &GraphQLContext,
        chore: ChoreInput,
    ) -> FieldResult<Chore> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreSvc::create(context, &chore.into()))
    }

    pub async fn update_chore(context: &GraphQLContext, chore: ChoreInput) -> FieldResult<Chore> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreSvc::update(context, &chore.into()))
    }

    pub async fn delete_chore(context: &GraphQLContext, chore_uuid: String) -> FieldResult<bool> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreSvc::delete(context, &chore_uuid))?;
        Ok(true)
    }

    /// Assigns a user to a chore. Admin-only. Assigning a user who is already assigned is a
    /// successful no-op.
    pub async fn assign_user_to_chore(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
    ) -> FieldResult<bool> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreSvc::assign_user(context, chore_id, user_id))?;
        Ok(true)
    }

    /// Removes a user's assignment to a chore. Admin-only, always returns true (including
    /// when no assignment existed), and leaves any completions the user already logged intact.
    pub async fn unassign_user_from_chore(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
    ) -> FieldResult<bool> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreSvc::unassign_user(context, chore_id, user_id))?;
        Ok(true)
    }

    // Chore Completions
    pub async fn create_chore_completion(
        context: &GraphQLContext,
        completion: ChoreCompletionInput,
    ) -> FieldResult<ChoreCompletion> {
        graphql_translate_anyhow(ChoreCompletionSvc::create(context, &completion))
    }

    /// Approves a logged completion. Requires an admin session, records which admin approved
    /// it and when, which is what makes the completion eligible for payout, and then re-runs
    /// the badge checks for the owning user.
    pub async fn approve_chore_completion(
        context: &GraphQLContext,
        completion_uuid: String,
    ) -> FieldResult<ChoreCompletion> {
        let admin_id = context.require_admin()?;
        graphql_translate_anyhow(ChoreCompletionSvc::approve(
            context,
            &completion_uuid,
            admin_id,
        ))
    }

    /// Settles up with the listed users: requires an admin session and marks every approved,
    /// unpaid completion belonging to any of them as paid, in a single statement. An empty
    /// `user_ids` is a no-op that still reports success.
    pub async fn mark_completions_as_paid(
        context: &GraphQLContext,
        user_ids: Vec<i32>,
    ) -> FieldResult<bool> {
        context.require_admin()?;
        if !user_ids.is_empty() {
            graphql_translate_anyhow(ChoreCompletionSvc::mark_as_paid_batch(context, &user_ids))?;
        }
        Ok(true)
    }

    pub async fn delete_chore_completion(
        context: &GraphQLContext,
        completion_uuid: String,
    ) -> FieldResult<bool> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreCompletionSvc::delete(context, &completion_uuid))?;
        Ok(true)
    }

    // Chore Completion Notes
    pub async fn create_chore_completion_note(
        context: &GraphQLContext,
        note: ChoreCompletionNoteInput,
    ) -> FieldResult<ChoreCompletionNote> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreCompletionNoteSvc::create(context, &note.into()))
    }

    pub async fn update_chore_completion_note(
        context: &GraphQLContext,
        note: ChoreCompletionNoteInput,
    ) -> FieldResult<ChoreCompletionNote> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreCompletionNoteSvc::update(context, &note.into()))
    }

    pub async fn delete_chore_completion_note(
        context: &GraphQLContext,
        note_uuid: String,
    ) -> FieldResult<bool> {
        context.require_admin()?;
        graphql_translate_anyhow(ChoreCompletionNoteSvc::delete(context, &note_uuid))?;
        Ok(true)
    }
}

/// Top-level Juniper GraphQL schema used by the server.
pub type Schema = RootNode<Query, Mutation, EmptySubscription<GraphQLContext>>;

/// Builds a new instance of the GraphQL schema.
pub fn create_schema() -> Schema {
    Schema::new(Query, Mutation, EmptySubscription::new())
}

/// Converts an `anyhow::Result` into a Juniper `FieldResult`, logging the error on failure.
pub fn graphql_translate_anyhow<T>(res: anyhow::Result<T>) -> FieldResult<T> {
    match res {
        Ok(t) => Ok(t),
        Err(e) => {
            error!("GraphQL error: {:#?}", e);
            Err(FieldError::from(e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Guards the one invariant the untested websocket path actually depends on: that
    /// the subscription *stream* path is unreachable.
    ///
    /// `custom_subscriptions` has no test coverage — the repo has no websocket
    /// harness. `juniper_graphql_ws` executes queries and mutations over the socket
    /// directly before ever considering the subscription root, so those DO resolve
    /// there today, unauthenticated (`admin_id: None`) — the same posture as a
    /// cookie-less HTTP request to `custom_graphql`, so this is not an escalation.
    /// What this test pins is narrower: it only type-checks while the schema's
    /// subscription root is `EmptySubscription`, so adding a real subscription
    /// breaks `cargo test` / `cargo clippy --all-targets` (not a plain `cargo build`)
    /// here and forces whoever does it to confront the missing coverage first.
    #[test]
    fn subscription_root_is_still_empty() {
        fn assert_empty_subscription_root(
            _: &RootNode<Query, Mutation, EmptySubscription<GraphQLContext>>,
        ) {
        }

        let schema = create_schema();
        assert_empty_subscription_root(&schema);
    }
}
