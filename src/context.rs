use super::db::SqlitePool;
use juniper::{FieldError, FieldResult};

/// Shared request context passed to every GraphQL resolver: a database pool and the
/// authenticated admin id, when present.
#[derive(Clone)]
pub struct GraphQLContext {
    pub pool: SqlitePool,
    pub admin_id: Option<i32>,
}

impl juniper::Context for GraphQLContext {}

impl GraphQLContext {
    /// The single authorization gate for admin-only GraphQL mutations: returns the
    /// authenticated admin id, or an `Unauthorized` `FieldError` when the request carries no
    /// admin session. Every privileged resolver must call this before doing any work.
    pub fn require_admin(&self) -> FieldResult<i32> {
        self.admin_id.ok_or_else(|| {
            FieldError::new(
                "Unauthorized: admin session required",
                juniper::Value::null(),
            )
        })
    }
}
