#![allow(clippy::too_many_arguments)]
use chrono::NaiveDate;
use juniper::{EmptySubscription, FieldError, FieldResult, RootNode};

use crate::{
    context::GraphQLContext,
    models::{
        Admin, AdminInput, Chore, ChoreCompletion, ChoreCompletionInput, ChoreCompletionNote,
        ChoreCompletionNoteInput, ChoreInput, UnpaidTotal, User, UserInput,
    },
    svc::{AdminSvc, ChoreCompletionNoteSvc, ChoreCompletionSvc, ChoreSvc, UserSvc},
};

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
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);
        graphql_translate_anyhow(UserSvc::list(context, limit, offset))
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
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);
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
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);
        let active_only = active_only.unwrap_or(true);
        graphql_translate_anyhow(ChoreSvc::list(context, user_id, active_only, limit, offset))
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
        user_id: Option<i32>,
        chore_id: Option<i32>,
        date_from: Option<NaiveDate>,
        date_to: Option<NaiveDate>,
        approved_only: Option<bool>,
        unpaid_only: Option<bool>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> FieldResult<Vec<ChoreCompletion>> {
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);
        graphql_translate_anyhow(ChoreCompletionSvc::list(
            context,
            user_id,
            chore_id,
            date_from,
            date_to,
            approved_only,
            unpaid_only,
            limit,
            offset,
        ))
    }

    // Get weekly view for a user
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

    // Get all completions for the week (for all users)
    pub fn get_all_weekly_completions(
        context: &GraphQLContext,
        week_start_date: NaiveDate,
    ) -> FieldResult<Vec<ChoreCompletion>> {
        graphql_translate_anyhow(ChoreCompletionSvc::get_all_weekly_completions(
            context,
            week_start_date,
        ))
    }

    // Get total unpaid amounts per user
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
}

pub struct Mutation;

#[juniper::graphql_object(context = GraphQLContext)]
impl Mutation {
    // Users
    pub async fn create_user(context: &GraphQLContext, user: UserInput) -> FieldResult<User> {
        graphql_translate_anyhow(UserSvc::create(context, &user.into()))
    }

    pub async fn update_user(context: &GraphQLContext, user: UserInput) -> FieldResult<User> {
        graphql_translate_anyhow(UserSvc::update(context, &user.into()))
    }

    pub async fn delete_user(context: &GraphQLContext, user_uuid: String) -> FieldResult<bool> {
        graphql_translate_anyhow(UserSvc::delete(context, &user_uuid))?;
        Ok(true)
    }

    // Admins
    pub async fn create_admin(context: &GraphQLContext, admin: AdminInput) -> FieldResult<Admin> {
        graphql_translate_anyhow(AdminSvc::create(context, &admin.into()))
    }

    pub async fn update_admin(context: &GraphQLContext, admin: AdminInput) -> FieldResult<Admin> {
        graphql_translate_anyhow(AdminSvc::update(context, &admin.into()))
    }

    // Chores
    pub async fn create_chore(context: &GraphQLContext, chore: ChoreInput) -> FieldResult<Chore> {
        graphql_translate_anyhow(ChoreSvc::create(context, &chore.into()))
    }

    pub async fn update_chore(context: &GraphQLContext, chore: ChoreInput) -> FieldResult<Chore> {
        graphql_translate_anyhow(ChoreSvc::update(context, &chore.into()))
    }

    pub async fn delete_chore(context: &GraphQLContext, chore_uuid: String) -> FieldResult<bool> {
        graphql_translate_anyhow(ChoreSvc::delete(context, &chore_uuid))?;
        Ok(true)
    }

    // Assign user to chore
    pub async fn assign_user_to_chore(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
    ) -> FieldResult<bool> {
        graphql_translate_anyhow(ChoreSvc::assign_user(context, chore_id, user_id))?;
        Ok(true)
    }

    // Remove user from chore
    pub async fn unassign_user_from_chore(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
    ) -> FieldResult<bool> {
        graphql_translate_anyhow(ChoreSvc::unassign_user(context, chore_id, user_id))?;
        Ok(true)
    }

    // Chore Completions
    pub async fn create_chore_completion(
        context: &GraphQLContext,
        completion: ChoreCompletionInput,
    ) -> FieldResult<ChoreCompletion> {
        graphql_translate_anyhow(ChoreCompletionSvc::create(context, &completion.into()))
    }

    pub async fn approve_chore_completion(
        context: &GraphQLContext,
        completion_uuid: String,
        admin_id: i32,
    ) -> FieldResult<ChoreCompletion> {
        graphql_translate_anyhow(ChoreCompletionSvc::approve(
            context,
            &completion_uuid,
            admin_id,
        ))
    }

    pub async fn mark_completions_as_paid(
        context: &GraphQLContext,
        user_ids: Vec<i32>, // Support multiple user IDs
    ) -> FieldResult<bool> {
        for user_id in user_ids {
            graphql_translate_anyhow(ChoreCompletionSvc::mark_as_paid(context, Some(user_id)))?;
        }
        Ok(true)
    }

    pub async fn delete_chore_completion(
        context: &GraphQLContext,
        completion_uuid: String,
    ) -> FieldResult<bool> {
        graphql_translate_anyhow(ChoreCompletionSvc::delete(context, &completion_uuid))?;
        Ok(true)
    }

    // Chore Completion Notes
    pub async fn create_chore_completion_note(
        context: &GraphQLContext,
        note: ChoreCompletionNoteInput,
    ) -> FieldResult<ChoreCompletionNote> {
        graphql_translate_anyhow(ChoreCompletionNoteSvc::create(context, &note.into()))
    }

    pub async fn update_chore_completion_note(
        context: &GraphQLContext,
        note: ChoreCompletionNoteInput,
    ) -> FieldResult<ChoreCompletionNote> {
        graphql_translate_anyhow(ChoreCompletionNoteSvc::update(context, &note.into()))
    }

    pub async fn delete_chore_completion_note(
        context: &GraphQLContext,
        note_uuid: String,
    ) -> FieldResult<bool> {
        graphql_translate_anyhow(ChoreCompletionNoteSvc::delete(context, &note_uuid))?;
        Ok(true)
    }
}

pub type Schema = RootNode<'static, Query, Mutation, EmptySubscription<GraphQLContext>>;
pub fn create_schema() -> Schema {
    Schema::new(Query, Mutation, EmptySubscription::new())
}

pub fn graphql_translate_anyhow<T>(res: anyhow::Result<T>) -> FieldResult<T> {
    match res {
        Ok(t) => Ok(t),
        Err(e) => Err(FieldError::from(e)),
    }
}
