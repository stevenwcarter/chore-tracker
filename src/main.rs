#![allow(non_snake_case)]

use chore_tracker::{context::GraphQLContext, net, routes::app};

use anyhow::{Context, Result};
use chore_tracker::db::get_pool;
use chore_tracker::get_env_typed;
use tracing::{error, info};

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<()> {
    use tokio::sync::mpsc;

    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let context = GraphQLContext::new(get_pool()?, None);

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
    // `::` binds one dual-stack socket serving IPv4 and IPv6 together; an
    // operator can still pin to a single address or family by setting
    // LISTEN_ADDRESS. See `chore_tracker::net`.
    let listen_address = get_env_typed::<String>("LISTEN_ADDRESS", "::".to_owned());
    let port = get_env_typed::<u16>("PORT", 7007);
    let addr = net::listen_addr(&listen_address, port)?;
    let listener = tokio::net::TcpListener::from_std(net::bind(addr)?)
        .with_context(|| format!("Failed to register the listener for {addr} with tokio"))?;
    if addr.is_ipv6() {
        info!("listener set up at {addr} (dual-stack: IPv4 and IPv6)");
    } else {
        info!("listener set up at {addr} (IPv4 only)");
    }
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
