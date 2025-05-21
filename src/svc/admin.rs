use crate::{context::GraphQLContext, db::get_conn, models::Admin, schema::admins};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct AdminSvc {}

impl AdminSvc {
    pub fn get(context: &GraphQLContext, admin_uuid: &str) -> Result<Admin> {
        admins::table
            .filter(admins::uuid.eq(admin_uuid))
            .select(Admin::as_select())
            .first(&mut get_conn(context))
            .context("Could not find admin")
    }

    pub fn get_by_oidc_subject(context: &GraphQLContext, oidc_subject: &str) -> Result<Admin> {
        admins::table
            .filter(admins::oidc_subject.eq(oidc_subject))
            .select(Admin::as_select())
            .first(&mut get_conn(context))
            .context("Could not find admin by OIDC subject")
    }

    pub fn list(context: &GraphQLContext, limit: i32, offset: i32) -> Result<Vec<Admin>> {
        let limit: i64 = limit.into();
        let offset: i64 = offset.into();

        admins::table
            .select(Admin::as_select())
            .order_by(admins::name.asc())
            .limit(limit)
            .offset(offset)
            .load::<Admin>(&mut get_conn(context))
            .context("Could not load admins")
    }

    pub fn create(context: &GraphQLContext, admin: &Admin) -> Result<Admin> {
        diesel::insert_into(admins::table)
            .values(admin)
            .execute(&mut get_conn(context))
            .context("Could not create admin")?;

        Self::get(context, &admin.uuid)
    }

    pub fn update(context: &GraphQLContext, admin: &Admin) -> Result<Admin> {
        diesel::update(admins::table)
            .filter(admins::uuid.eq(&admin.uuid))
            .set(admin)
            .execute(&mut get_conn(context))
            .context("Could not update admin")?;

        Self::get(context, &admin.uuid)
    }

    pub fn get_or_create_by_oidc(context: &GraphQLContext, oidc_subject: &str, name: &str, email: &str) -> Result<Admin> {
        // First try to get existing admin
        match Self::get_by_oidc_subject(context, oidc_subject) {
            Ok(admin) => Ok(admin),
            Err(_) => {
                // Admin doesn't exist, create a new one
                let new_admin = Admin {
                    id: None,
                    uuid: uuid::Uuid::new_v4().to_string(),
                    name: name.to_string(),
                    email: email.to_string(),
                    oidc_subject: oidc_subject.to_string(),
                    created_at: None,
                    updated_at: None,
                };
                
                Self::create(context, &new_admin)
            }
        }
    }

    pub fn delete(context: &GraphQLContext, admin_uuid: &str) -> Result<()> {
        diesel::delete(admins::table)
            .filter(admins::uuid.eq(admin_uuid))
            .execute(&mut get_conn(context))
            .context("Could not delete admin")?;

        Ok(())
    }
}