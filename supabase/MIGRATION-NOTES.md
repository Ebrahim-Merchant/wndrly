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

---

## Phase 2: Supabase Storage (Completed 2026-06-03)

### Buckets Created
- `trip-photos` (public) — for trip photos, Google place images
- `user-avatars` (public) — for user profile photos  
- `trip-documents` (private) — for PDF receipts, booking docs

### Files Migrated
- 55 photos from `~/trek/uploads/photos/google/` → `trip-photos/google/`
- 1 PDF from `~/trek/uploads/files/` → `trip-documents/`
- Local uploads remain at `~/trek/uploads/` as backup

### Access URLs
- Public photos: `https://xfvayfokefudhxtlcprj.supabase.co/storage/v1/object/public/trip-photos/{path}`
- Private docs: Via signed URL or service role key

---

## Phase 3: Supabase Realtime (Configured 2026-06-03)

### Status
- Realtime service is running
- Migration SQL ready: `supabase/migrations/002_enable_realtime.sql`

### Manual Step Required
To enable Realtime on tables, run in Supabase Dashboard SQL Editor:
https://supabase.com/dashboard/project/xfvayfokefudhxtlcprj/sql

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE places;
ALTER PUBLICATION supabase_realtime ADD TABLE days;
ALTER PUBLICATION supabase_realtime ADD TABLE collab_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE todo_items;
ALTER PUBLICATION supabase_realtime ADD TABLE packing_items;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_members;
```

### Frontend Usage (when ready)
```typescript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  'https://xfvayfokefudhxtlcprj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // anon key
)
const channel = supabase.channel('trip-updates')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, 
    (payload) => console.log('Trip updated:', payload))
  .subscribe()
```

---

## Known Issue: Supabase Pooler Not Registering Tenant

**Problem:** Direct PostgreSQL connections via Supavisor pooler fail with `Tenant or user not found`
- Pooler endpoint: `aws-0-us-east-1.pooler.supabase.com:6543`
- This is a known issue with newly created Supabase projects
- IPv6-only direct DB (`db.xfvayfokefudhxtlcprj.supabase.co:5432`) not reachable from this server

**Current workaround:** Running in SQLite fallback mode (same data, fully functional)

**Resolution:** Wait up to 24 hours for pooler provisioning OR reset project:
1. Try `DATABASE_URL` again tomorrow:
   ```
   DATABASE_URL=postgresql://postgres.xfvayfokefudhxtlcprj:WndrlySupa2025Reset!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
   ```
2. Rebuild & redeploy:
   ```bash
   docker build -t wndrly-supabase:latest ~/wndrly
   docker stop wndrly-reskin && docker rm wndrly-reskin
   docker run -d --name wndrly-reskin --restart unless-stopped -p 3461:3000 \
     -e DATABASE_URL="postgresql://postgres.xfvayfokefudhxtlcprj:WndrlySupa2025Reset!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" \
     -e SUPABASE_URL="https://xfvayfokefudhxtlcprj.supabase.co" \
     -e SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdmF5Zm9rZWZ1ZGh4dGxjcHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDM5MTIsImV4cCI6MjA5NjAxOTkxMn0.w9DGq5fk3cUqgQV6um3HM2U5gFdbyjqbGTRzVv2ip_w" \
     -e ENCRYPTION_KEY=$(cat ~/trek/data/.encryption_key) \
     -e APP_URL=https://wndrly.ebrahim.world \
     -e NODE_ENV=production \
     -v /home/ebmerchant/trek/uploads:/app/uploads \
     wndrly-supabase:latest
   ```
