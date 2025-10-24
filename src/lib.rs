#![allow(deprecated)]
#![warn(clippy::str_to_string)]
#![recursion_limit = "256"]

// use chrono::{DateTime, NaiveDateTime, Utc};
// use chrono_tz::Tz;
use std::{env, fmt, str::FromStr};

pub mod api;
pub mod auth;
pub mod context;
pub mod db;
pub mod graphql;
pub mod models;
pub mod routes;
pub mod schema;
pub mod svc;

// pub(crate) fn format_millis(millis: i64) -> String {
//     let secs = millis / 1000;
//     let nsecs = (millis % 1000) * 1_000_000;
//
//     let datetime =
//         NaiveDateTime::from_timestamp_opt(secs, nsecs as u32).expect("Invalid timestamp");
//
//     let datetime: DateTime<Utc> = DateTime::<Utc>::from_utc(datetime, Utc);
//
//     let tz: Tz = chrono_tz::UTC;
//
//     let datetime = datetime.with_timezone(&tz);
//
//     datetime.format("%Y-%m-%d %H:%M:%S%.3f").to_string()
// }

/// Return an environment variable typed generically
///
/// ```
/// use chore_tracker::get_env;
/// assert!(get_env("PATH", "test").len() > 4);
/// ````
pub fn get_env(search_key: &str, default: &str) -> String {
    env::vars()
        .filter(|(key, _)| key.eq(search_key))
        .map(|(_, value)| value)
        .next()
        .unwrap_or(default.to_owned())
}

/// Return an environment variable typed generically
///
/// ```
/// use chore_tracker::get_env_typed;
/// assert!(get_env_typed::<u16>("SHLVL", 9) > 0);
/// ````
pub fn get_env_typed<T>(search_key: &str, default: T) -> T
where
    T: FromStr + fmt::Debug,
{
    let value: Option<String> = env::vars()
        .filter(|(key, _)| key.eq(search_key))
        .map(|(_, value)| value)
        .next();

    match value {
        Some(value) => value.parse::<T>().unwrap_or(default),
        _ => default,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_gets_env_variables() {
        assert!(get_env("PATH", "test").len() > 4);
    }

    #[test]
    fn it_gets_env_variables_default() {
        assert!(get_env("FOOBAR", "test").eq("test"));
    }

    #[test]
    fn it_gets_typed_env_variables() {
        unsafe {
            std::env::set_var("FOO", "77");
        }
        assert!(get_env_typed::<u16>("FOO", 9) == 77);
    }

    #[test]
    fn it_gets_typed_env_variables_default() {
        assert!(get_env_typed::<u16>("FOOBAR", 9) == 9);
    }

    #[test]
    fn it_gets_typed_env_variables_default_string() {
        assert_eq!(
            get_env_typed::<String>("FOOBAR", "0.0.0.0".to_owned()),
            "0.0.0.0".to_owned()
        );
    }
}
