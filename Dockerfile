# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS web-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --no-audit --no-fund; else npm ci --no-audit --no-fund; fi
COPY frontend/ ./
RUN npm run build

FROM eclipse-temurin:21-jdk-jammy AS engine-build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=web-build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY gradle/ gradle/
COPY gradlew settings.gradle build.gradle ./
COPY backend/ backend/
COPY deploy/build-backend.sh deploy/build-backend.sh
RUN --mount=type=secret,id=proxy_ca bash deploy/build-backend.sh

FROM eclipse-temurin:21-jre-jammy AS runtime
RUN groupadd --gid 10001 rocket && useradd --uid 10001 --gid rocket --create-home rocket && mkdir -p /app/data && chown rocket:rocket /app/data
WORKDIR /app
COPY --from=engine-build /app/backend/build/install/backend /app/backend
COPY --from=web-build /app/frontend/dist /app/frontend
ENV BIND_HOST=0.0.0.0 PORT=10000 WEB_DIR=/app/frontend DATA_DIR=/app/data REQUIRE_AUTH=true ALLOWED_ORIGINS=https://gherablimanar.github.io
USER rocket
EXPOSE 10000
CMD ["/app/backend/bin/backend"]
