use crate::{context::GraphQLContext, db::get_conn, models::User, schema::users};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct UserSvc {}

impl UserSvc {
    pub fn get(context: &GraphQLContext, user_uuid: &str) -> Result<User> {
        users::table
            .filter(users::uuid.eq(user_uuid))
            .select(User::as_select())
            .first(&mut get_conn(context))
            .context("Could not find user")
    }

    pub fn get_by_id(context: &GraphQLContext, user_id: i32) -> Result<User> {
        users::table
            .filter(users::id.eq(user_id))
            .select(User::as_select())
            .first(&mut get_conn(context))
            .context("Could not find user")
    }

    pub fn list(context: &GraphQLContext, limit: i32, offset: i32) -> Result<Vec<User>> {
        let limit: i64 = limit.into();
        let offset: i64 = offset.into();

        users::table
            .select(User::as_select())
            .order_by(users::name.asc())
            .limit(limit)
            .offset(offset)
            .load::<User>(&mut get_conn(context))
            .context("Could not load users")
    }

    pub fn create(context: &GraphQLContext, user: &User) -> Result<User> {
        diesel::insert_into(users::table)
            .values(user)
            .execute(&mut get_conn(context))
            .context("Could not create user")?;

        Self::get(context, &user.uuid)
    }

    pub fn update(context: &GraphQLContext, user: &User) -> Result<User> {
        diesel::update(users::table)
            .filter(users::uuid.eq(&user.uuid))
            .set(user)
            .execute(&mut get_conn(context))
            .context("Could not update user")?;

        Self::get(context, &user.uuid)
    }

    pub fn delete(context: &GraphQLContext, user_uuid: &str) -> Result<()> {
        diesel::delete(users::table)
            .filter(users::uuid.eq(user_uuid))
            .execute(&mut get_conn(context))
            .context("Could not delete user")?;

        Ok(())
    }
}