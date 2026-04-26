use super::db::SqlitePool;
use juniper::{FieldError, FieldResult};

#[derive(Clone)]
pub struct GraphQLContext {
    pub pool: SqlitePool,
    pub admin_id: Option<i32>,
}

impl juniper::Context for GraphQLContext {}

impl GraphQLContext {
    pub fn require_admin(&self) -> FieldResult<i32> {
        self.admin_id
            .ok_or_else(|| FieldError::new("Unauthorized: admin session required", juniper::Value::null()))
    }
}
