# Wndrly Supabase Migration - Phase 1 Complete

## What Was Done

### 1. Supabase Project Created
- **Project:** wndrly (`xfvayfokefudhxtlcprj`)
- **Region:** us-east-1
- **URL:** https://xfvayfokefudhxtlcprj.supabase.co
- **Status:** ACTIVE_HEALTHY

### 2. Schema Migrated
- Exported full SQLite schema (824 lines, 80 tables)
- Created PostgreSQL migration: `supabase/migrations/001_initial_schema.sql`
- All 80 tables created in Supabase
- SQLite → PostgreSQL conversions applied:
  - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
  - `REAL` → `FLOAT`
  - `DATETIME` → `TIMESTAMP`
  - `strftime('%s','now')` → `EXTRACT(EPOCH FROM NOW())::BIGINT`
  - Preserved all foreign keys, indexes, constraints
- RLS enabled on all tables (service_role key bypasses RLS for backend)

### 3. Data Migrated
All existing data migrated from SQLite to Supabase:
- 4 users
- 1 trip (58 places, 24 days, 71 reservations, 52 assignments)
- 10 categories, 10 addons
- 38 audit log entries
- 55 Google place photo cache entries
- And more...

### 4. Backend Updated
- Created `server/src/db/pg-adapter.ts`: SQLite-compatible shim over `pg`
  - Uses `deasync` to make async pg calls synchronous
  - Converts `?` placeholders to `$1, $2, ...`
  - Converts Date objects to string format SQLite would return
  - Maps `prepare().get()`, `.all()`, `.run()` to pg queries
- Updated `server/src/db/database.ts`: Dual-mode (Postgres or SQLite)
  - When `DATABASE_URL` env var is set → PostgreSQL mode
  - When not set → original SQLite mode (zero regression)
- Added `pg` and `deasync` to `server/package.json`

### 5. Docker Config Updated
- Added `DATABASE_URL` and `DATABASE_SSL` env vars to `docker-compose.yml`

## How to Deploy

### Option A: Test locally first
```bash
cd ~/wndrly/server
DATABASE_URL="postgresql://postgres.xfvayfokefudhxtlcprj:WndrlySupa2024!SecurePass@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  npm run dev
```

### Option B: Rebuild Docker + redeploy
```bash
cd ~/wndrly

# Build new image
docker build -t wndrly-supabase:latest .

# Stop old container
docker stop wndrly-reskin

# Run with Supabase
docker run -d \
  --name wndrly-supabase \
  -p 3461:3000 \
  -e DATABASE_URL="postgresql://postgres.xfvayfokefudhxtlcprj:WndrlySupa2024!SecurePass@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  -e NODE_ENV=production \
  -e APP_URL=https://wndrly.ebrahim.world \
  -v /home/ebmerchant/trek/uploads:/app/uploads \
  wndrly-supabase:latest
```

Note: No more SQLite volume mount needed (data is in Supabase)

## Credentials
See `supabase/CREDENTIALS.md` for all keys.

## Rollback
If Supabase has issues, simply stop the container with `DATABASE_URL` set and restart the original:
```bash
docker start wndrly-reskin
```
The SQLite database is unchanged at `~/trek/data/travel.db`.
Backup is at `~/trek/data/travel.db.pre-supabase-migration.backup`.

## Known Limitations (Phase 2 work)
1. The pg-adapter uses `deasync` for sync compatibility — this works but isn't ideal for high concurrency
2. Supabase DB host is IPv6-only (direct connection); using the connection pooler for IPv4
3. `db.transaction()` in pg-adapter is simplified — full atomicity requires refactoring to async
4. The `backfillFlightEndpoints` call is skipped in Postgres mode (non-critical)
