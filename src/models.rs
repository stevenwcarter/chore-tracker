//! Data model layer: Diesel row structs, their Juniper GraphQL objects and input types, the
//! `PaymentType` and `BadgeType` enums, and the payment-calculation logic on `PaymentType`.
//!
//! Only the original Diesel struct skeletons came from `diesel_ext`; everything since -
//! resolvers, payment maths, and the tests at the bottom of the file - is hand-maintained,
//! so edit this file directly rather than regenerating it.

#![allow(unused)]
#![allow(clippy::all)]

use anyhow::Context;
use chrono::{NaiveDate, NaiveDateTime, Utc};
use diesel::prelude::*;
use juniper::{GraphQLEnum, GraphQLInputObject, GraphQLObject};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tracing::{debug, info};
use uuid::Uuid;

use crate::{
    context::GraphQLContext,
    schema::*,
    svc::ChoreCompletionNoteSvc,
};

// Enums
/// How a chore's `amount_cents` is converted into a per-completion payout.
///
/// `Daily` pays the full amount for every completion. `Weekly` treats the amount as a
/// whole-week total and splits it evenly across the days set in the chore's `required_days`
/// mask.
///
/// Round-trips to the database as the lowercase strings `"daily"` and `"weekly"`; any other
/// stored value is read back as `Daily`.
#[derive(Debug, Clone, PartialEq, Eq, GraphQLEnum)]
pub enum PaymentType {
    Daily,
    Weekly,
}

impl<T: AsRef<str>> From<T> for PaymentType {
    fn from(value: T) -> Self {
        match value.as_ref().to_lowercase().as_str() {
            "weekly" => Self::Weekly,
            _ => Self::Daily,
        }
    }
}

impl From<PaymentType> for String {
    fn from(pt: PaymentType) -> Self {
        match pt {
            PaymentType::Daily => "daily".to_owned(),
            PaymentType::Weekly => "weekly".to_owned(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, GraphQLEnum)]
pub enum AuthorType {
    User,
    Admin,
}

impl<T: AsRef<str>> From<T> for AuthorType {
    fn from(value: T) -> Self {
        match value.as_ref().to_lowercase().as_str() {
            "admin" => Self::Admin,
            _ => Self::User,
        }
    }
}

impl From<AuthorType> for String {
    fn from(at: AuthorType) -> Self {
        match at {
            AuthorType::User => "user".to_owned(),
            AuthorType::Admin => "admin".to_owned(),
        }
    }
}

// User model
#[derive(Queryable, Debug, Clone, Identifiable, Insertable, Selectable, AsChangeset)]
#[diesel(primary_key(id))]
#[diesel(table_name = users)]
pub struct User {
    pub id: Option<i32>,
    pub uuid: String,
    pub name: String,
    pub image_path: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
    pub image_id: Option<i32>,
}

#[juniper::graphql_object(context = GraphQLContext)]
impl User {
    pub fn id(&self) -> Option<i32> {
        self.id
    }
    pub fn uuid(&self) -> &str {
        &self.uuid
    }
    pub fn name(&self) -> &str {
        &self.name
    }
    /// URL for this user's profile image, or `None` when they have none.
    ///
    /// Answered entirely from the already-loaded `image_id` column: this
    /// resolver runs once per user in a result set, so querying `user_images`
    /// here fanned out to chores x users on nested selections. `image_id`
    /// is set on upload and cleared on delete, so its presence is equivalent
    /// to the row existing.
    ///
    /// `?v=` carries the image id because `/images/user/{id}` is a stable URL
    /// served with a 24h `Cache-Control`; without a changing key a replaced
    /// avatar would stay stale in the browser for a day.
    pub fn image_path(&self) -> Option<String> {
        let user_id = self.id?;
        let image_id = self.image_id?;
        Some(format!("/images/user/{user_id}?v={image_id}"))
    }
    pub fn created_at(&self) -> Option<NaiveDateTime> {
        self.created_at
    }
    pub fn updated_at(&self) -> Option<NaiveDateTime> {
        self.updated_at
    }
    pub fn image_id(&self) -> Option<i32> {
        self.image_id
    }
}

// User image model for storing images in database
#[derive(Queryable, Debug, Clone, Identifiable, Selectable)]
#[diesel(primary_key(id))]
#[diesel(table_name = user_images)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct UserImage {
    pub id: i32,
    pub uuid: Option<String>,
    pub user_id: i32,
    pub image_data: Vec<u8>,
    pub content_type: String,
    pub file_size: i32,
    pub created_at: NaiveDateTime,
}

// Lightweight struct for metadata queries — does not load image_data blob
#[derive(Queryable, Debug, Clone, Selectable)]
#[diesel(table_name = user_images)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct UserImageMeta {
    pub id: i32,
    pub uuid: Option<String>,
    pub user_id: i32,
    pub content_type: String,
    pub file_size: i32,
    pub created_at: NaiveDateTime,
}

// Struct for inserting new user images (without id)
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = user_images)]
pub struct NewUserImage {
    pub uuid: String,
    pub user_id: i32,
    pub image_data: Vec<u8>,
    pub content_type: String,
    pub file_size: i32,
    pub created_at: NaiveDateTime,
}

// Input for user image upload
#[derive(Debug, Clone)]
pub struct UserImageInput {
    pub user_id: i32,
    pub image_data: Vec<u8>,
    pub content_type: String,
    pub file_size: i32,
}

impl From<UserImageInput> for NewUserImage {
    fn from(input: UserImageInput) -> Self {
        Self {
            uuid: Uuid::now_v7().to_string(),
            user_id: input.user_id,
            image_data: input.image_data,
            content_type: input.content_type,
            file_size: input.file_size,
            created_at: Utc::now().naive_utc(),
        }
    }
}

#[derive(GraphQLInputObject, Debug, Clone)]
pub struct UserInput {
    pub uuid: Option<String>,
    pub name: String,
    pub image_path: Option<String>,
}

impl From<UserInput> for User {
    fn from(input: UserInput) -> Self {
        Self {
            id: None,
            uuid: crate::uuid_or_generate(input.uuid),
            name: input.name,
            image_path: None,
            created_at: None,
            updated_at: None,
            image_id: None,
        }
    }
}

// Admin model
#[derive(
    Queryable, Debug, Identifiable, Insertable, Selectable, AsChangeset, GraphQLObject, Serialize,
)]
#[diesel(primary_key(id))]
#[diesel(table_name = admins)]
pub struct Admin {
    pub id: Option<i32>,
    pub uuid: String,
    pub name: String,
    pub email: String,
    pub oidc_subject: String,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}

#[derive(GraphQLInputObject, Debug, Clone)]
pub struct AdminInput {
    pub uuid: Option<String>,
    pub name: String,
    pub email: String,
    pub oidc_subject: String,
}

impl From<AdminInput> for Admin {
    fn from(input: AdminInput) -> Self {
        Self {
            id: None,
            uuid: crate::uuid_or_generate(input.uuid),
            name: input.name,
            email: input.email,
            oidc_subject: input.oidc_subject,
            created_at: None,
            updated_at: None,
        }
    }
}

// AdminSession model
#[derive(
    Queryable, Debug, Identifiable, Insertable, Selectable, AsChangeset,
)]
#[diesel(primary_key(id))]
#[diesel(table_name = admin_sessions)]
pub struct AdminSession {
    pub id: Option<i32>,
    pub session_token: String,
    pub admin_id: i32,
    pub created_at: NaiveDateTime,
    pub expires_at: NaiveDateTime,
}

// Chore model
#[derive(Queryable, Debug, Clone, Identifiable, Insertable, Selectable, AsChangeset)]
#[diesel(primary_key(id))]
#[diesel(table_name = chores)]
pub struct Chore {
    pub id: Option<i32>,
    pub uuid: String,
    pub name: String,
    pub description: Option<String>,
    pub payment_type: String, // Will be converted to/from PaymentType enum in GraphQL
    pub amount_cents: i32,
    /// Bitmask of the weekdays this chore is scheduled for: 1 = Mon, 2 = Tue, 4 = Wed,
    /// 8 = Thu, 16 = Fri, 32 = Sat, 64 = Sun. 0 means no scheduled days. For weekly chores
    /// the popcount of this mask is the divisor that splits `amount_cents` into per-day
    /// payouts.
    pub required_days: i32,
    pub active: bool,
    pub created_by_admin_id: i32,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
    pub bonus_date: Option<NaiveDate>,
    pub max_claims: Option<i32>,
    /// Start of the chore's yearly availability window, MMDD-encoded
    /// (`month * 100 + day`), or `None` for a chore available year round.
    /// Always set together with `available_end`; see `crate::availability`.
    ///
    /// `#[diesel(skip_update)]`: Diesel's derived `AsChangeset` omits `None` fields
    /// from the UPDATE rather than setting them to NULL, which would make it
    /// impossible to *clear* an availability window. `ChoreSvc::update` sets this
    /// column explicitly instead; see the comment there.
    #[diesel(skip_update)]
    pub available_start: Option<i32>,
    /// End of the yearly availability window, MMDD-encoded and inclusive. When
    /// `available_end < available_start` the window wraps the new year, which is
    /// the normal case for a school-year chore (Sep 1 - Jun 15).
    ///
    /// `#[diesel(skip_update)]`: see `available_start`.
    #[diesel(skip_update)]
    pub available_end: Option<i32>,
}

#[juniper::graphql_object(context = GraphQLContext)]
impl Chore {
    pub fn id(&self) -> Option<i32> {
        self.id
    }
    pub fn uuid(&self) -> &str {
        &self.uuid
    }
    pub fn name(&self) -> &str {
        &self.name
    }
    pub fn description(&self) -> Option<&str> {
        self.description.as_deref()
    }
    pub fn payment_type(&self) -> PaymentType {
        PaymentType::from(&self.payment_type)
    }
    pub fn amount_cents(&self) -> i32 {
        self.amount_cents
    }
    pub fn required_days(&self) -> i32 {
        self.required_days
    }
    pub fn active(&self) -> bool {
        self.active
    }
    pub fn created_by_admin_id(&self) -> i32 {
        self.created_by_admin_id
    }
    pub fn created_at(&self) -> Option<NaiveDateTime> {
        self.created_at
    }
    pub fn updated_at(&self) -> Option<NaiveDateTime> {
        self.updated_at
    }
    pub fn bonus_date(&self) -> Option<NaiveDate> {
        self.bonus_date
    }
    pub fn max_claims(&self) -> Option<i32> {
        self.max_claims
    }
    /// The chore's yearly availability window, or null when it is available year
    /// round. A window whose end sorts before its start wraps the new year.
    ///
    /// Deliberately fails **open**: `.ok().flatten()` below means a malformed
    /// `available_start`/`available_end` pair (e.g. corrupted MMDD data) renders as
    /// "year round" rather than as an error. This is the opposite of
    /// `ensure_within_availability_window` in `svc::chore_completion`, which
    /// propagates the same parse error with `?` and rejects the completion - i.e.
    /// fails **closed**. That asymmetry is intentional: display should degrade
    /// gracefully rather than break the UI, but money (accepting/rejecting a
    /// completion) should never proceed on data we couldn't validate.
    pub fn availability_window(&self) -> Option<AvailabilityWindowGql> {
        crate::availability::AvailabilityWindow::from_columns(
            self.available_start,
            self.available_end,
        )
        .ok()
        .flatten()
        .map(|w| AvailabilityWindowGql {
            start_month: w.start().month(),
            start_day: w.start().day(),
            end_month: w.end().month(),
            end_day: w.end().day(),
        })
    }
    pub fn assigned_users(&self, context: &GraphQLContext) -> juniper::FieldResult<Vec<User>> {
        use crate::schema::chore_assignments::dsl::*;
        use crate::schema::users::dsl as users_dsl;

        let connection = &mut context.pool.get()?;
        let assignments = chore_assignments
            .filter(chore_id.eq(self.id.ok_or_else(|| {
                juniper::FieldError::new("Chore has no id", juniper::Value::null())
            })?))
            .load::<ChoreAssignment>(connection)?;

        let user_ids: Vec<i32> = assignments.iter().map(|a| a.user_id).collect();
        let users_vec = users_dsl::users
            .filter(users_dsl::id.eq_any(&user_ids))
            .load::<User>(connection)?;
        debug!("Assigned users for chore {:?}", assignments);
        Ok(users_vec)
    }
}

/// GraphQL input for a chore's yearly availability window. Absent means the chore
/// is available year round; present means both ends are supplied.
#[derive(GraphQLInputObject, Debug, Clone, Copy)]
pub struct AvailabilityWindowInput {
    pub start_month: i32,
    pub start_day: i32,
    pub end_month: i32,
    pub end_day: i32,
}

impl AvailabilityWindowInput {
    /// Validates and converts to the pair of MMDD column values.
    fn to_columns(self) -> anyhow::Result<(i32, i32)> {
        let to_u32 = |v: i32, what: &str| {
            u32::try_from(v).map_err(|_| anyhow::anyhow!("{what} must not be negative, got {v}"))
        };
        let start = crate::availability::MonthDay::new(
            to_u32(self.start_month, "start month")?,
            to_u32(self.start_day, "start day")?,
        )?;
        let end = crate::availability::MonthDay::new(
            to_u32(self.end_month, "end month")?,
            to_u32(self.end_day, "end day")?,
        )?;
        Ok((start.as_mmdd(), end.as_mmdd()))
    }
}

/// GraphQL output object for a chore's availability window.
#[derive(GraphQLObject, Debug, Clone, Copy)]
#[graphql(name = "AvailabilityWindow")]
pub struct AvailabilityWindowGql {
    pub start_month: i32,
    pub start_day: i32,
    pub end_month: i32,
    pub end_day: i32,
}

#[derive(GraphQLInputObject, Debug, Clone)]
pub struct ChoreInput {
    pub uuid: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub payment_type: PaymentType,
    pub amount_cents: i32,
    pub required_days: i32,
    pub active: Option<bool>,
    pub created_by_admin_id: i32,
    pub bonus_date: Option<NaiveDate>,
    pub max_claims: Option<i32>,
    pub availability_window: Option<AvailabilityWindowInput>,
}

impl TryFrom<ChoreInput> for Chore {
    type Error = anyhow::Error;

    fn try_from(input: ChoreInput) -> anyhow::Result<Self> {
        let (available_start, available_end) = match input.availability_window {
            Some(window) => {
                let (start, end) = window.to_columns()?;
                (Some(start), Some(end))
            }
            None => (None, None),
        };

        Ok(Self {
            id: None,
            uuid: crate::uuid_or_generate(input.uuid),
            name: input.name,
            description: input.description,
            payment_type: input.payment_type.into(),
            amount_cents: input.amount_cents,
            required_days: input.required_days,
            active: input.active.unwrap_or(true),
            created_by_admin_id: input.created_by_admin_id,
            created_at: None,
            updated_at: None,
            bonus_date: input.bonus_date,
            max_claims: input.max_claims,
            available_start,
            available_end,
        })
    }
}

// Chore Assignment model
#[derive(Queryable, Clone, Debug, Identifiable, Insertable, Selectable, AsChangeset)]
#[diesel(primary_key(id))]
#[diesel(table_name = chore_assignments)]
pub struct ChoreAssignment {
    pub id: Option<i32>,
    pub chore_id: i32,
    pub user_id: i32,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(GraphQLInputObject, Debug, Clone)]
pub struct ChoreAssignmentInput {
    pub chore_id: i32,
    pub user_id: i32,
}

impl From<ChoreAssignmentInput> for ChoreAssignment {
    fn from(input: ChoreAssignmentInput) -> Self {
        Self {
            id: None,
            chore_id: input.chore_id,
            user_id: input.user_id,
            created_at: None,
        }
    }
}

// Chore Completion model
#[derive(Queryable, Debug, Identifiable, Insertable, Selectable, AsChangeset)]
#[diesel(primary_key(id))]
#[diesel(table_name = chore_completions)]
pub struct ChoreCompletion {
    pub id: Option<i32>,
    pub uuid: String,
    pub chore_id: i32,
    pub user_id: i32,
    pub completed_date: NaiveDate,
    pub amount_cents: i32,
    pub approved: bool,
    pub approved_by_admin_id: Option<i32>,
    pub approved_at: Option<NaiveDateTime>,
    pub paid_out: bool,
    pub paid_out_at: Option<NaiveDateTime>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}

/// Looks up `id` in `cache`, calling `fetch` and memoizing the result on a miss.
///
/// The mutex is only ever held for the lookup and the insert; `fetch` (a database round
/// trip) always runs with the lock released, so a resolver can never hold the mutex across
/// I/O.
fn cached_by_id<T: Clone>(
    cache: &Mutex<HashMap<i32, T>>,
    id: i32,
    fetch: impl FnOnce() -> juniper::FieldResult<T>,
) -> juniper::FieldResult<T> {
    let hit = cache.lock()?.get(&id).cloned();
    if let Some(hit) = hit {
        return Ok(hit);
    }

    let value = fetch()?;
    cache.lock()?.insert(id, value.clone());
    Ok(value)
}

// Custom GraphQL object implementation for ChoreCompletion to add relationships
#[juniper::graphql_object(context = GraphQLContext)]
impl ChoreCompletion {
    pub fn id(&self) -> Option<i32> {
        self.id
    }

    pub fn uuid(&self) -> &str {
        &self.uuid
    }

    pub fn chore_id(&self) -> i32 {
        self.chore_id
    }

    pub fn user_id(&self) -> i32 {
        self.user_id
    }

    pub fn completed_date(&self) -> NaiveDate {
        self.completed_date
    }

    pub fn amount_cents(&self) -> i32 {
        self.amount_cents
    }

    pub fn approved(&self) -> bool {
        self.approved
    }

    pub fn approved_by_admin_id(&self) -> Option<i32> {
        self.approved_by_admin_id
    }

    pub fn approved_at(&self) -> Option<NaiveDateTime> {
        self.approved_at
    }

    pub fn paid_out(&self) -> bool {
        self.paid_out
    }

    pub fn paid_out_at(&self) -> Option<NaiveDateTime> {
        self.paid_out_at
    }

    pub fn created_at(&self) -> Option<NaiveDateTime> {
        self.created_at
    }

    pub fn updated_at(&self) -> Option<NaiveDateTime> {
        self.updated_at
    }

    // Relationship fields
    pub async fn chore(&self, context: &GraphQLContext) -> juniper::FieldResult<Chore> {
        use diesel::prelude::*;

        cached_by_id(&context.chore_cache, self.chore_id, || {
            chores::table
                .filter(chores::id.eq(self.chore_id))
                .first::<Chore>(&mut context.pool.get()?)
                .map_err(|e| juniper::FieldError::from(anyhow::anyhow!(e)))
        })
    }

    pub async fn user(&self, context: &GraphQLContext) -> juniper::FieldResult<User> {
        use diesel::prelude::*;

        cached_by_id(&context.user_cache, self.user_id, || {
            users::table
                .filter(users::id.eq(self.user_id))
                .first::<User>(&mut context.pool.get()?)
                .context("fetching user for chore completion")
                .map_err(juniper::FieldError::from)
        })
    }

    pub async fn notes(
        &self,
        context: &GraphQLContext,
    ) -> juniper::FieldResult<Vec<ChoreCompletionNote>> {
        Ok(ChoreCompletionNoteSvc::list_for_completion(
            context,
            self.id.ok_or_else(|| {
                juniper::FieldError::new("ChoreCompletion has no id", juniper::Value::null())
            })?,
            context.admin_id.is_none(),
        )
        .context("fetching chore completion notes")?)
    }

    pub async fn admin_notes(
        &self,
        context: &GraphQLContext,
    ) -> juniper::FieldResult<Vec<ChoreCompletionNote>> {
        context.require_admin()?;
        Ok(ChoreCompletionNoteSvc::list_for_completion(
            context,
            self.id.ok_or_else(|| {
                juniper::FieldError::new("ChoreCompletion has no id", juniper::Value::null())
            })?,
            true,
        )
        .context("fetching admin chore completion notes")?)
    }
}

// Payment calculation utilities
impl PaymentType {
    /// Counts how many days a chore is assigned for, i.e. the set bits in the `required_days`
    /// mask: 1 = Mon, 2 = Tue, 4 = Wed, 8 = Thu, 16 = Fri, 32 = Sat, 64 = Sun.
    ///
    /// This is a plain popcount, so any bit set above 64 is counted too. Callers must pass a
    /// mask already validated to be in `0..=127`, or the weekly payout will be divided by too
    /// many days.
    pub(crate) fn get_assigned_days_count(required_days: i32) -> i32 {
        required_days.count_ones() as i32
    }

    /// Rounds an amount to the nearest quarter (25 cents).
    ///
    /// Weekly chores are rounded per-day, so the daily payouts intentionally need not sum
    /// back to the chore's total: 150 cents split over 5 days pays 25 cents a day, 125 cents
    /// across the week rather than 150.
    pub(crate) fn round_to_nearest_quarter(amount: f64) -> i32 {
        let quarters = (amount / 25.0).round() as i64;
        i32::try_from(quarters * 25).unwrap_or(i32::MAX)
    }

    /// Calculates what a single chore completion is worth, in cents.
    ///
    /// [`Self::Daily`] chores pay `chore_amount_cents` for every completion.
    /// [`Self::Weekly`] chores treat `chore_amount_cents` as the whole-week total and pay
    /// `chore_amount_cents / count_ones(required_days)` per completion, rounded to the
    /// nearest 25 cents - so a $1.50 chore assigned to 3 days pays $0.50 a day. A
    /// `required_days` of 0 has no days to divide by and falls back to the full amount.
    ///
    /// `required_days` is the weekday bitmask: 1 = Mon, 2 = Tue, 4 = Wed, 8 = Thu, 16 = Fri,
    /// 32 = Sat, 64 = Sun.
    pub fn calculate_completion_amount(
        payment_type: &Self,
        chore_amount_cents: i32,
        required_days: i32,
    ) -> i32 {
        match payment_type {
            Self::Daily => {
                // Daily chores pay the full amount for each completion
                chore_amount_cents
            }
            Self::Weekly => {
                // Weekly chores pay a fraction based on how many days they're assigned for
                let assigned_days_count = Self::get_assigned_days_count(required_days);

                if assigned_days_count == 0 {
                    // Fallback: if no days assigned, pay the full amount
                    chore_amount_cents
                } else {
                    let fraction_amount = chore_amount_cents as f64 / assigned_days_count as f64;
                    Self::round_to_nearest_quarter(fraction_amount)
                }
            }
        }
    }
}

#[derive(GraphQLInputObject, Debug, Clone)]
pub struct ChoreCompletionInput {
    pub uuid: Option<String>,
    pub chore_id: i32,
    pub user_id: i32,
    pub completed_date: NaiveDate,
}

// Chore Completion Note model
#[derive(Queryable, Debug, Identifiable, Insertable, Selectable, AsChangeset)]
#[diesel(primary_key(id))]
#[diesel(table_name = chore_completion_notes)]
pub struct ChoreCompletionNote {
    pub id: Option<i32>,
    pub uuid: String,
    pub chore_completion_id: i32,
    pub author_type: String, // Will be converted to/from AuthorType enum in GraphQL
    pub author_user_id: Option<i32>,
    pub author_admin_id: Option<i32>,
    pub note_text: String,
    pub visible_to_user: bool,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}

#[juniper::graphql_object(context = GraphQLContext)]
impl ChoreCompletionNote {
    pub fn id(&self) -> Option<i32> {
        self.id
    }
    pub fn uuid(&self) -> &str {
        &self.uuid
    }
    pub fn chore_completion_id(&self) -> i32 {
        self.chore_completion_id
    }
    pub fn author_type(&self) -> AuthorType {
        AuthorType::from(&self.author_type)
    }
    pub fn author_user_id(&self) -> Option<i32> {
        self.author_user_id
    }
    pub fn author_admin_id(&self) -> Option<i32> {
        self.author_admin_id
    }
    pub fn note_text(&self) -> &str {
        &self.note_text
    }
    pub fn visible_to_user(&self) -> bool {
        self.visible_to_user
    }
    pub fn created_at(&self) -> Option<NaiveDateTime> {
        self.created_at
    }
    pub fn updated_at(&self) -> Option<NaiveDateTime> {
        self.updated_at
    }
}

#[derive(GraphQLInputObject, Debug, Clone)]
pub struct ChoreCompletionNoteInput {
    pub uuid: Option<String>,
    pub chore_completion_id: i32,
    pub author_type: AuthorType,
    pub author_user_id: Option<i32>,
    pub author_admin_id: Option<i32>,
    pub note_text: String,
    pub visible_to_user: Option<bool>,
}

impl From<ChoreCompletionNoteInput> for ChoreCompletionNote {
    fn from(input: ChoreCompletionNoteInput) -> Self {
        Self {
            id: None,
            uuid: crate::uuid_or_generate(input.uuid),
            chore_completion_id: input.chore_completion_id,
            author_type: input.author_type.into(),
            author_user_id: input.author_user_id,
            author_admin_id: input.author_admin_id,
            note_text: input.note_text,
            visible_to_user: input.visible_to_user.unwrap_or(true),
            created_at: None,
            updated_at: None,
        }
    }
}

/// An achievement a user can earn. Each variant is persisted as the snake_case string
/// returned by [`Self::as_str`] (`first_chore`, `ten_dollars_earned`, ...).
///
/// - `FirstChore` - at least one approved completion.
/// - `TenDollarsEarned` / `FiftyDollarsEarned` - approved completions totalling at least
///   1000 / 5000 cents.
/// - `PerfectWeek` - every chore assigned to the user completed within a single ISO week.
/// - `FiveDayStreak` - approved completions on 5 consecutive calendar days.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BadgeType {
    FirstChore,
    TenDollarsEarned,
    FiftyDollarsEarned,
    PerfectWeek,
    FiveDayStreak,
}

impl BadgeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::FirstChore => "first_chore",
            Self::TenDollarsEarned => "ten_dollars_earned",
            Self::FiftyDollarsEarned => "fifty_dollars_earned",
            Self::PerfectWeek => "perfect_week",
            Self::FiveDayStreak => "five_day_streak",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "first_chore" => Some(Self::FirstChore),
            "ten_dollars_earned" => Some(Self::TenDollarsEarned),
            "fifty_dollars_earned" => Some(Self::FiftyDollarsEarned),
            "perfect_week" => Some(Self::PerfectWeek),
            "five_day_streak" => Some(Self::FiveDayStreak),
            _ => None,
        }
    }

    pub fn all() -> Vec<Self> {
        vec![
            Self::FirstChore,
            Self::TenDollarsEarned,
            Self::FiftyDollarsEarned,
            Self::PerfectWeek,
            Self::FiveDayStreak,
        ]
    }
}

// UserBadge model
#[derive(Queryable, Debug)]
pub struct UserBadge {
    pub id: i32,
    pub user_id: i32,
    pub badge_type: String,
    pub earned_at: NaiveDateTime,
}

#[juniper::graphql_object(context = GraphQLContext)]
impl UserBadge {
    pub fn id(&self) -> i32 {
        self.id
    }

    pub fn user_id(&self) -> i32 {
        self.user_id
    }

    pub fn badge_type(&self) -> &str {
        &self.badge_type
    }

    pub fn earned_at(&self) -> NaiveDateTime {
        self.earned_at
    }
}

// Helper GraphQL object for unpaid totals
#[derive(Debug, Clone)]
pub struct UnpaidTotal {
    pub user: User,
    pub amount_cents: i32,
}

#[juniper::graphql_object(context = GraphQLContext)]
impl UnpaidTotal {
    pub fn user(&self) -> &User {
        &self.user
    }
    pub fn amount_cents(&self) -> i32 {
        self.amount_cents
    }
}

impl UnpaidTotal {
    pub fn new(user: User, amount_cents: i32) -> Self {
        Self { user, amount_cents }
    }
}

/// A kid's earned-but-unpaid total, regardless of approval status. Distinct from
/// [`UnpaidTotal`], which is approved-and-unpaid and drives the payout screen.
#[derive(Debug, Clone)]
pub struct PendingTotal {
    pub user: User,
    pub amount_cents: i32,
}

#[juniper::graphql_object(context = GraphQLContext)]
impl PendingTotal {
    pub fn user(&self) -> &User {
        &self.user
    }
    pub fn amount_cents(&self) -> i32 {
        self.amount_cents
    }
}

impl PendingTotal {
    pub fn new(user: User, amount_cents: i32) -> Self {
        Self { user, amount_cents }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{svc::ChoreCompletionSvc, test_helpers::test_db};

    #[test]
    fn test_payment_type_from_string() {
        assert_eq!(PaymentType::from("daily"), PaymentType::Daily);
        assert_eq!(PaymentType::from("weekly"), PaymentType::Weekly);
        assert_eq!(PaymentType::from("other"), PaymentType::Daily);
        assert_eq!(PaymentType::from("WEEkly"), PaymentType::Weekly);
    }
    #[test]
    fn test_author_type_from_string() {
        assert_eq!(AuthorType::from("user"), AuthorType::User);
        assert_eq!(AuthorType::from("admin"), AuthorType::Admin);
        assert_eq!(AuthorType::from("other"), AuthorType::User);
        assert_eq!(AuthorType::from("ADmin"), AuthorType::Admin);
    }

    /// Creates a chore completion for `user_id` on a fixed test date.
    fn create_completion_for_test(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
    ) -> ChoreCompletion {
        let input = ChoreCompletionInput {
            uuid: None,
            chore_id,
            user_id,
            completed_date: test_db::create_test_date(2024, 10, 21),
        };
        ChoreCompletionSvc::create(context, &input).unwrap()
    }

    /// Creates a chore completion for `chore`/`user` on the `day_offset`-th day of the
    /// fixed test month (October 2024), so a batch of completions for one test each land
    /// on a distinct `completed_date`.
    fn create_completion_on_day(
        context: &GraphQLContext,
        chore: &Chore,
        user: &User,
        day_offset: u32,
    ) -> ChoreCompletion {
        let input = ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: test_db::create_test_date(2024, 10, 21 + day_offset),
        };
        ChoreCompletionSvc::create(context, &input).unwrap()
    }

    /// Creates an admin-authored note on `completion_id` with the given visibility.
    ///
    /// Notes are always admin-authored in production (`create_chore_completion_note`
    /// requires an admin session), so this resolves the completion's chore back to the
    /// admin who created it rather than accepting an author id, keeping the helper's
    /// signature limited to what the characterization tests need.
    fn add_note(
        context: &GraphQLContext,
        completion_id: i32,
        note_text: &str,
        visible_to_user: bool,
    ) {
        // The test pool holds a single connection, so this must be released (end of
        // block) before `ChoreCompletionNoteSvc::create` below asks the pool for one.
        let admin_id: i32 = {
            let mut conn = context.pool.get().unwrap();
            let chore_id: i32 = chore_completions::table
                .filter(chore_completions::id.eq(completion_id))
                .select(chore_completions::chore_id)
                .first(&mut conn)
                .unwrap();
            chores::table
                .filter(chores::id.eq(chore_id))
                .select(chores::created_by_admin_id)
                .first(&mut conn)
                .unwrap()
        };

        let input = ChoreCompletionNoteInput {
            uuid: None,
            chore_completion_id: completion_id,
            author_type: AuthorType::Admin,
            author_user_id: None,
            author_admin_id: Some(admin_id),
            note_text: note_text.to_owned(),
            visible_to_user: Some(visible_to_user),
        };
        ChoreCompletionNoteSvc::create(context, &ChoreCompletionNote::from(input)).unwrap();
    }

    // These two tests drive the actual `ChoreCompletion::notes` resolver (not the svc
    // function directly) so they characterize the resolver's visibility gate itself,
    // not just the already-correct filtering inside `ChoreCompletionNoteSvc`.
    #[tokio::test]
    async fn notes_hide_admin_only_entries_from_unauthenticated_requests() {
        let context = test_db::create_test_context(); // admin_id: None
        let admin = test_db::create_test_admin(&context, "Parent", "parent@example.com");
        let user = test_db::create_test_user(&context, "Kid");
        let chore = test_db::create_test_chore(
            &context,
            "Dishes",
            PaymentType::Daily,
            100,
            test_db::day_patterns::monday_only(),
            admin.id.unwrap(),
        );

        let completion = create_completion_for_test(&context, chore.id.unwrap(), user.id.unwrap());
        add_note(&context, completion.id.unwrap(), "visible to kid", true);
        add_note(&context, completion.id.unwrap(), "admin eyes only", false);

        let notes = completion.notes(&context).await.unwrap();

        assert_eq!(
            notes.len(),
            1,
            "unauthenticated request must not receive admin-only notes"
        );
        assert_eq!(notes[0].note_text, "visible to kid");
    }

    #[tokio::test]
    async fn notes_include_admin_only_entries_for_admin_requests() {
        let mut context = test_db::create_test_context();
        let admin = test_db::create_test_admin(&context, "Parent", "parent@example.com");
        context.admin_id = Some(admin.id.unwrap());

        let user = test_db::create_test_user(&context, "Kid");
        let chore = test_db::create_test_chore(
            &context,
            "Dishes",
            PaymentType::Daily,
            100,
            test_db::day_patterns::monday_only(),
            admin.id.unwrap(),
        );

        let completion = create_completion_for_test(&context, chore.id.unwrap(), user.id.unwrap());
        add_note(&context, completion.id.unwrap(), "visible to kid", true);
        add_note(&context, completion.id.unwrap(), "admin eyes only", false);

        let notes = completion.notes(&context).await.unwrap();

        assert_eq!(
            notes.len(),
            2,
            "admin request must still receive every note"
        );
    }

    // Pins the values `ChoreCompletion::chore` and `::user` resolve today, before they
    // gain a per-request memo cache - the follow-up tidy commit must keep returning the
    // same rows, just with fewer queries.
    #[tokio::test]
    async fn batched_resolvers_return_the_same_values_as_before() {
        let context = test_db::create_test_context();
        let admin = test_db::create_test_admin(&context, "Parent", "p@example.com");

        let alice = test_db::create_test_user(&context, "Alice");
        let bob = test_db::create_test_user(&context, "Bob");
        let dishes = test_db::create_test_chore(
            &context,
            "Dishes",
            PaymentType::Daily,
            100,
            test_db::day_patterns::monday_only(),
            admin.id.unwrap(),
        );
        let trash = test_db::create_test_chore(
            &context,
            "Trash",
            PaymentType::Daily,
            250,
            test_db::day_patterns::monday_only(),
            admin.id.unwrap(),
        );

        // Interleave so a cache keyed on anything but the id resolves the wrong row.
        let expected = [
            (&dishes, &alice),
            (&trash, &bob),
            (&dishes, &bob),
            (&trash, &alice),
        ];

        let completions: Vec<_> = expected
            .iter()
            .enumerate()
            .map(|(i, (chore, user))| create_completion_on_day(&context, chore, user, i as u32))
            .collect();

        for (completion, (chore, user)) in completions.iter().zip(expected.iter()) {
            let resolved_chore = completion.chore(&context).await.unwrap();
            let resolved_user = completion.user(&context).await.unwrap();
            assert_eq!(
                resolved_chore.id, chore.id,
                "completion resolved the wrong chore -- cache mis-keyed?"
            );
            assert_eq!(
                resolved_chore.name, chore.name,
                "resolved chore name mismatch"
            );
            assert_eq!(
                resolved_user.id, user.id,
                "completion resolved the wrong user -- cache mis-keyed?"
            );
            assert_eq!(resolved_user.name, user.name, "resolved user name mismatch");
        }
    }
}
