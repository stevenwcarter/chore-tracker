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
    JuniperRequest(request): JuniperRequest,
) -> JuniperResponse {
    JuniperResponse(request.execute(&*schema, &context).await)
}