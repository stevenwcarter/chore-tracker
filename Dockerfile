FROM docker.io/blackdex/rust-musl:x86_64-musl AS dependencybuilder
WORKDIR /home/rust/src
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
COPY ynab-api ./ynab-api/
RUN cargo fetch
RUN cargo build --release
RUN rm src/main.rs

FROM dependencybuilder AS builder
COPY --from=dependencybuilder /home/rust/src/target ./target/
COPY ynab-api ./ynab-api/
COPY src ./src/
COPY migrations ./migrations/
COPY site/build ./site/build
RUN touch src/main.rs
# RUN apt-get update && apt-get install upx
RUN cargo build --release
#&& upx target/x86_64-unknown-linux-musl/release/chore-tracker

FROM scratch
WORKDIR /
COPY --from=builder /home/rust/src/target/x86_64-unknown-linux-musl/release/chore-tracker chore-tracker
COPY env.prod .env

EXPOSE 4000

CMD ["/chore-tracker"]
