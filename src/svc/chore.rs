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
