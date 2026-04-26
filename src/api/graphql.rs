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

async fn custom_subscriptions(
    Extension(schema): Extension<Arc<Schema>>,
    Extension(context): Extension<GraphQLContext>,
    ws: WebSocketUpgrade,
) -> Response {
    ws.protocols(["graphql-transport-ws", "graphql-ws"])
        .on_upgrade(move |socket| {
            let connection_config =
                ConnectionConfig::new(context.clone()).with_max_in_flight_operations(10);
            subscriptions::serve_ws(socket, schema, connection_config)
        })
}

async fn custom_graphql(
    Extension(schema): Extension<Arc<Schema>>,
    Extension(context): Extension<GraphQLContext>,
    jar: axum_extra::extract::CookieJar,
    JuniperRequest(request): JuniperRequest,
) -> JuniperResponse {
    use crate::svc::AdminSvc;
    let admin_id = jar
        .get("admin_session")
        .and_then(|c| {
            AdminSvc::get_session(&context, c.value())
                .ok()
                .flatten()
                .and_then(|a| a.id)
        });
    let authed_context = crate::context::GraphQLContext {
        pool: context.pool.clone(),
        admin_id,
    };
    JuniperResponse(request.execute(&*schema, &authed_context).await)
}
