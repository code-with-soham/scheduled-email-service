# Local development setup

This project uses Docker only for local PostgreSQL, Redis, and Elasticsearch. The backend itself still runs from your host shell.

## 1. Start Docker Desktop

Open Docker Desktop and wait until it reports that the Docker Engine is running.

## 2. Start services

From this directory, run:

```powershell
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

Wait until all services show `healthy`. Inspect startup failures with:

```powershell
docker compose -f docker-compose.dev.yml logs
```

## 3. Verify PostgreSQL

```powershell
docker compose -f docker-compose.dev.yml exec postgres pg_isready -U scheduler -d reachinbox
```

Expected result: `accepting connections`.

## 4. Verify Redis

```powershell
docker compose -f docker-compose.dev.yml exec redis redis-cli ping
```

Expected result: `PONG`.

## 5. Verify Elasticsearch

```powershell
Invoke-RestMethod http://localhost:9200
```

Expected result: a JSON response with Elasticsearch cluster details.

## 6. Configure `.env`

Copy `.env.example` to `.env`. The PostgreSQL, Redis, and Elasticsearch development URLs already match `docker-compose.dev.yml`.

Before starting the backend, replace the `ETHEREAL_SENDERS` placeholders with real Ethereal SMTP credentials. Configure `GOOGLE_CLIENT_ID` for authenticated API requests. Set a long local-only `BULL_BOARD_PASSWORD`; do not commit `.env`.

Slack settings are optional for basic local infrastructure. Set them only when testing the real Slack OAuth flow.

## 7. Run database initialization

```powershell
pnpm run db:init
```

This applies the schema and seeds configured SMTP senders and sender-to-tenant assignments.

## 8. Start backend

```powershell
pnpm start
```

The API runs on `http://localhost:4000` by default.

## 9. Verify Bull Board

Open `http://localhost:4000/admin/queues` and authenticate with `BULL_BOARD_USERNAME` and `BULL_BOARD_PASSWORD` from your local `.env`.

## 10. Stop services

```powershell
docker compose -f docker-compose.dev.yml down
```

The named volumes preserve local PostgreSQL, Redis, and Elasticsearch data. To intentionally remove development data as well, run `docker compose -f docker-compose.dev.yml down -v`.
