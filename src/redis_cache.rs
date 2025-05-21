use anyhow::Context;
use redis::Client;
use redis_pool::{RedisPool, SingleRedisPool};

use crate::get_env;
use lazy_static::lazy_static;

lazy_static! {
    static ref POOL: SingleRedisPool = {
        let redis_host = get_env("REDIS_HOST", "localhost");
        let redis_port = get_env("REDIS_PORT", "6379");
        let client = Client::open(format!("redis://{redis_host}:{redis_port}/"))
            .expect("Could not connect to redis");

        RedisPool::from(client)
    };
}

pub async fn read(cache_key: &str) -> anyhow::Result<Vec<u8>> {
    let mut conn = POOL
        .acquire()
        .await
        .context("Could not get redis connection")?;

    redis::cmd("GET")
        .arg(cache_key)
        .query_async(&mut conn)
        .await
        .context("Could not make get request to redis")
}
pub async fn write(cache_key: &str, data: &[u8]) -> anyhow::Result<()> {
    let mut conn = POOL
        .acquire()
        .await
        .context("Could not get redis connection")?;

    redis::pipe()
        .set(cache_key, data)
        .ignore()
        .query_async(&mut conn)
        .await
        .context("Could not write to redis")
}

pub async fn remove(cache_key: &str) -> anyhow::Result<()> {
    let mut conn = POOL
        .acquire()
        .await
        .context("Could not get redis connection")?;

    redis::cmd("DEL")
        .arg(cache_key)
        .query_async::<()>(&mut conn)
        .await
        .context("could not delete entry")?;

    Ok(())
}
