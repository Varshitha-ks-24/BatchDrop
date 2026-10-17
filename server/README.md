# BatchDrop API (Phase 1)

This is an isolated Node.js + Express API package. Phase 2 adds a PostgreSQL connection pool, safe database status reporting, and an initial orders-table migration. It is not connected to the React frontend and does not expose order read/write endpoints. Authentication and delivery dispatch are not implemented.

## Requirements

- Node.js 18 or newer
- npm

## Install and configure

From the repository root:

```sh
cd server
npm install
cp .env.example .env
```

The documented local defaults are `PORT=3001` and `FRONTEND_ORIGIN=http://localhost:5173`. Both values are optional when starting locally. `PORT` must be an integer from 1 to 65535. `FRONTEND_ORIGIN` must be an HTTP or HTTPS origin without a path. The example file contains placeholders/defaults only; do not put database credentials in it.

To check a database, set `DATABASE_URL` in the ignored `server/.env` file to a PostgreSQL connection URL. Without it, the API still starts and liveness remains available; database status reports `not_configured`. The connection pool is created by the server only and uses bounded connection and idle timeouts.

The `/api/v1/health` endpoint is a liveness check and does not require PostgreSQL. `/api/v1/status` runs `SELECT 1` through the pool and reports only `connected`, `unavailable`, or `not_configured`. A failed or unconfigured database check returns HTTP 503. Connection strings and driver errors are not returned by the endpoint.

## Start and verify

From the repository root, start the backend only:

```sh
npm run backend
```

Or, from `server/`, run `npm start`. Check the health endpoint:

```sh
curl http://localhost:3001/api/v1/health
```

Expected response:

```json
{"status":"ok","service":"batchdrop-api"}
```

Run the backend tests from `server/` with `npm test`. They use mocked pool objects and do not require database credentials or a running PostgreSQL server.

## Apply the initial migration manually

Review `migrations/001_create_orders.sql` before applying it. It creates the `orders` table and an index using `CREATE TABLE IF NOT EXISTS`; it does not drop tables or delete rows. This project does not run migrations automatically. Back up the target database and apply the SQL explicitly with a PostgreSQL client when ready, for example:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_create_orders.sql
```

The schema maps the current frontend order fields: stable text ID, shop name, optional pickup details (not currently collected by the UI), destination label and local-grid coordinates, package capacity units, deadline, and the current `Preparing`, `Ready`, and `Approved` statuses. The `x/y` values are fictional local grid coordinates, not GPS or road-routing data.

## Configuration and safety

The API applies CORS for the configured frontend origin. CORS is not authentication or access control. There are intentionally no order endpoints until authentication and shop/neighborhood authorization policies are designed.

Keep `DATABASE_URL` server-only. For eventual Render deployment, add it using the service's encrypted environment-variable settings; never set it as a `VITE_*` value, place it in frontend code, or commit it. Configure `PORT` and `FRONTEND_ORIGIN` in the Render environment as appropriate. Rotate credentials if they are ever exposed. No real credentials are present in this repository's `.env.example`.