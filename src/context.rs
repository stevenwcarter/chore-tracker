use super::db::SqlitePool;

#[derive(Clone)]
pub struct GraphQLContext {
    pub pool: SqlitePool,
}

impl juniper::Context for GraphQLContext {}
