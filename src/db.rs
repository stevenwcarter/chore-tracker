use std::error::Error;

use anyhow::{Context as _, Result};
use diesel::prelude::*;
use diesel::r2d2::{self, ConnectionManager, CustomizeConnection, Pool, PooledConnection};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use std::fs;
use std::time::Duration;

use crate::context::GraphQLContext;

/// Diesel connection manager for SQLite.
pub type ConnectionMgr = ConnectionManager<SqliteConnection>;
/// r2d2 pool of SQLite connections used throughout the application.
pub type SqlitePool = Pool<ConnectionManager<SqliteConnection>>;

/// r2d2 connection customizer that sets `PRAGMA busy_timeout` and enables foreign keys
/// on each acquired connection.
#[derive(Debug)]
pub struct ConnectionOptions {
    pub busy_timeout: Option<Duration>,
}

impl CustomizeConnection<SqliteConnection, diesel::r2d2::Error> for ConnectionOptions {
    fn on_acquire(&self, conn: &mut SqliteConnection) -> Result<(), diesel::r2d2::Error> {
        (|| {
            if let Some(d) = self.busy_timeout {
                diesel::sql_query(format!("PRAGMA busy_timeout = {};", d.as_millis()))
                    .execute(conn)?;
            }
            diesel::sql_query("PRAGMA foreign_keys = ON;").execute(conn)?;
            Ok(())
        })()
        .map_err(diesel::r2d2::Error::QueryError)
    }
}

/// Builds an SQLite connection pool from the `DATABASE_URL` environment variable
/// (defaults to `db/db.sqlite`), creating the parent directory if needed.
pub fn get_pool() -> Result<SqlitePool> {
    use dotenvy::dotenv;
    use std::env;
    dotenv().ok();
    let url = env::var("DATABASE_URL").unwrap_or_else(|_| "db/db.sqlite".to_owned());
    build_pool_for_url(&url)
}

/// Builds an SQLite connection pool for an explicit URL, creating the parent directory
/// of the database file if needed. Used by `get_pool` and integration tests.
pub fn build_pool_for_url(url: &str) -> Result<SqlitePool> {
    if let Some(parent) = std::path::Path::new(url).parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent).context("Could not create database directory")?;
    }

    let mgr = ConnectionManager::<SqliteConnection>::new(url);
    r2d2::Pool::builder()
        .min_idle(Some(3))
        .max_size(20)
        .connection_customizer(Box::new(ConnectionOptions {
            busy_timeout: Some(Duration::from_secs(2)),
        }))
        .build(mgr)
        .context("could not build connection pool")
}

pub(crate) fn get_conn(
    context: &GraphQLContext,
) -> anyhow::Result<PooledConnection<ConnectionMgr>> {
    context.pool.get().context("Could not get db connection")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_pool_for_url_in_memory_works() {
        // Characterization: the happy path returns a usable pool for an in-memory SQLite URL
        // (no directory creation needed).
        let pool = build_pool_for_url(":memory:").expect("in-memory pool should build");
        assert!(
            pool.get().is_ok(),
            "expected to acquire a connection from in-memory pool"
        );
    }
}

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();
/// Runs all pending Diesel migrations against the given database connection.
pub fn run_migrations(
    connection: &mut impl MigrationHarness<diesel::sqlite::Sqlite>,
) -> Result<(), Box<dyn Error + Send + Sync + 'static>> {
    connection.run_pending_migrations(MIGRATIONS)?;

    Ok(())
}
