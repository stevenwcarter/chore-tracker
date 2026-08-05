use super::db::SqlitePool;
use super::models::{Chore, User};
use juniper::{FieldError, FieldResult};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Shared request context passed to every GraphQL resolver.
///
/// Carries a database pool, the authenticated admin id when present, and per-request memo
/// caches for relationship resolvers that would otherwise repeat identical lookups — e.g.
/// the weekly completions grid, which resolves the same handful of chores and users for
/// every completion in the week.
#[derive(Clone)]
pub struct GraphQLContext {
    pub pool: SqlitePool,
    pub admin_id: Option<i32>,
    /// Per-request memo of chores already resolved, keyed by chore id.
    pub chore_cache: Arc<Mutex<HashMap<i32, Chore>>>,
    /// Per-request memo of users already resolved, keyed by user id.
    pub user_cache: Arc<Mutex<HashMap<i32, User>>>,
}

impl juniper::Context for GraphQLContext {}

impl GraphQLContext {
    /// Builds a context for `pool` with the given admin session and fresh, empty
    /// per-request caches. Construct a new context per request rather than cloning one
    /// across requests, or the caches will serve stale rows to later requests.
    pub fn new(pool: SqlitePool, admin_id: Option<i32>) -> Self {
        Self {
            pool,
            admin_id,
            chore_cache: Arc::new(Mutex::new(HashMap::new())),
            user_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

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
