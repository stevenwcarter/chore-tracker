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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::User;
    use crate::test_helpers::test_db::create_test_pool;

    // Pins the invariant documented on `GraphQLContext::new`: constructing a new context per
    // request (rather than cloning one across requests) must give each context its own,
    // independent caches. If this test ever fails, something has gone back to sharing
    // `chore_cache`/`user_cache` (e.g. `Extension<GraphQLContext>` being `.clone()`d instead of
    // rebuilt) — see the websocket subscription handler in `src/api/graphql.rs`, which used to
    // do exactly that.
    #[test]
    fn new_contexts_do_not_share_cache_state() {
        let pool = create_test_pool();

        let ctx1 = GraphQLContext::new(pool.clone(), None);
        let ctx2 = GraphQLContext::new(pool, None);

        let user = User {
            id: Some(1),
            uuid: "user-1".to_string(),
            name: "Alice".to_string(),
            image_path: None,
            created_at: None,
            updated_at: None,
            image_id: None,
        };
        ctx1.user_cache.lock().unwrap().insert(1, user);

        assert_eq!(
            ctx1.user_cache.lock().unwrap().len(),
            1,
            "sanity check: ctx1 should hold the row we just inserted"
        );
        assert!(
            ctx2.user_cache.lock().unwrap().is_empty(),
            "a freshly constructed GraphQLContext must not see cache entries populated on \
             another context, even one built from the same pool"
        );

        // Also confirm the two contexts really are backed by distinct Arcs, not merely
        // coincidentally both empty.
        assert!(!Arc::ptr_eq(&ctx1.user_cache, &ctx2.user_cache));
        assert!(!Arc::ptr_eq(&ctx1.chore_cache, &ctx2.chore_cache));
    }
}
