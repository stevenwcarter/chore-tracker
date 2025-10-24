#![allow(non_snake_case)]

use chore_tracker::{context::GraphQLContext, routes::app};

use chore_tracker::db::get_pool;
use chore_tracker::get_env_typed;
use lambda_http::{Error, tracing};
use tracing::{error, info};

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<(), Error> {
    use tokio::sync::mpsc;

    dotenvy::dotenv().ok();
    tracing::init_default_subscriber();

    let context = GraphQLContext { pool: get_pool() };

    let mut conn = context
        .pool
        .clone()
        .get()
        .expect("Could not get connections for migrations");
    let migration_result = chore_tracker::db::run_migrations(&mut conn);
    match migration_result {
        Ok(_) => info!("Migrations completed"),
        Err(e) => error!("Could not run migrations {:?}", e),
    };

    let app = app(context.clone()).await;

    let (tx, mut rx) = mpsc::channel(1);
    let listen_address = get_env_typed::<String>("LISTEN_ADDRESS", "0.0.0.0".to_owned());
    let port = get_env_typed::<u16>("PORT", 7007);
    let listener = tokio::net::TcpListener::bind(format!("{listen_address}:{port}"))
        .await
        .unwrap();
    info!("listener set up at {listen_address}:{port}");
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            tokio::signal::ctrl_c()
                .await
                .expect("failed to listen for shutdown signal");
            tx.send(())
                .await
                .expect("could not send shutdown signal to thread");
        })
        .await
        .expect("Could not keep server open");

    rx.recv().await;

    Ok(())
}
