use crate::api::AppError;
use crate::auth::admin_id_from_jar;
use crate::context::GraphQLContext;
use crate::graphql::Schema;

use axum::extract::WebSocketUpgrade;
use axum::response::Response;
use axum::routing::{MethodFilter, get, on};
use axum::{Extension, Router};
use juniper_axum::extract::JuniperRequest;
use juniper_axum::response::JuniperResponse;
use juniper_axum::{graphiql, playground, subscriptions};
use juniper_graphql_ws::ConnectionConfig;
use std::sync::Arc;

/// Builds the GraphQL router exposing the main endpoint (`/`), websocket subscriptions,
/// GraphiQL, and the Playground UI.
pub fn graphql_routes() -> Router {
    Router::new()
        .route(
            "/",
            on(MethodFilter::GET.or(MethodFilter::POST), custom_graphql),
        )
        .route("/subscriptions", get(custom_subscriptions))
        .route(
            "/graphiql",
            get(graphiql("/graphql", "/graphql/subscriptions")),
        )
        .route(
            "/playground",
            get(playground("/graphql", "/graphql/subscriptions")),
        )
        .route("/test", get(root))
}

async fn root() -> &'static str {
    "Hello world!"
}

// Subscriptions use the base context (admin_id: None) — no subscription currently requires admin auth.
//
// No test coverage: the repo has no websocket harness. `juniper_graphql_ws` executes
// queries and mutations over this socket directly — it only falls through to the
// subscription resolver on `GraphQLError::IsSubscription` — so the full `Query` and
// `Mutation` root is reachable here today, unauthenticated. That is not an escalation:
// `custom_graphql` also resolves to `admin_id: None` for a cookie-less request, so this
// matches anonymous HTTP GraphQL access. What's actually unreachable is the subscription
// *stream* path, because the schema's subscription root is `EmptySubscription` — an
// invariant pinned by `graphql::tests::subscription_root_is_still_empty`, which is
// `#[cfg(test)]` and so only fires under `cargo test` / `cargo clippy --all-targets`, not
// under a plain `cargo build`. That guard covers exactly one trigger — a change to
// `pub type Schema`'s third (subscription) parameter — and does not protect the
// query/mutation surface described above. Before adding a real subscription, add a
// harness that exercises this handler; a prior cache-sharing bug here was caught only
// by manual inspection.
async fn custom_subscriptions(
    Extension(schema): Extension<Arc<Schema>>,
    Extension(context): Extension<GraphQLContext>,
    ws: WebSocketUpgrade,
) -> Response {
    ws.protocols(["graphql-transport-ws", "graphql-ws"])
        .on_upgrade(move |socket| {
            // Construct a fresh context rather than cloning `context` — cloning would share
            // the process-wide chore_cache/user_cache with every other request for the life
            // of the process. See context.rs.
            let connection_config =
                ConnectionConfig::new(GraphQLContext::new(context.pool.clone(), None))
                    .with_max_in_flight_operations(10);
            subscriptions::serve_ws(socket, schema, connection_config)
        })
}

async fn custom_graphql(
    Extension(schema): Extension<Arc<Schema>>,
    Extension(context): Extension<GraphQLContext>,
    jar: axum_extra::extract::CookieJar,
    JuniperRequest(request): JuniperRequest,
) -> Result<JuniperResponse, AppError> {
    let admin_id = admin_id_from_jar(&context, &jar)?;
    let authed_context = GraphQLContext::new(context.pool.clone(), admin_id);
    Ok(JuniperResponse(
        request.execute(&*schema, &authed_context).await,
    ))
}
