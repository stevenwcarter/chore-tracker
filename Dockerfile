FROM docker.io/blackdex/rust-musl:x86_64-musl AS dependencybuilder
WORKDIR /home/rust/src
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo fetch
RUN cargo build --release
RUN rm src/main.rs

FROM dependencybuilder AS builder
COPY --from=dependencybuilder /home/rust/src/target ./target/
COPY src ./src/
COPY migrations ./migrations/
RUN touch src/main.rs
RUN cargo build --release

FROM scratch
WORKDIR /
COPY --from=builder /home/rust/src/target/x86_64-unknown-linux-musl/release/axum-react-starter axum-react-starter
COPY env.prod .env
COPY site/build ./site/build
COPY config.toml.prod-docker config.toml

EXPOSE 4000

CMD ["/axum-react-starter"]
