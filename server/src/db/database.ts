import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createTables } from './schema';
import { runMigrations } from './migrations';
import { runSeeds } from './seeds';
import { Place, Tag } from '../types';

// ============================================================
// PostgreSQL mode: when DATABASE_URL is set, use pg-adapter
// ============================================================
const USE_POSTGRES = !!process.env.DATABASE_URL;

let db: Database.Database | ReturnType<typeof createPgDb>;

function createPgDb() {
  console.log('[DB] Using PostgreSQL (Supabase) mode');
  // Dynamic require to avoid loading pg/deasync in SQLite mode
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { db: pgDb } = require('./pg-adapter');
  return pgDb;
}

// ============================================================
// SQLite mode (original)
// ============================================================
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'travel.db');

let _sqliteDb: Database.Database | null = null;

function initSqliteDb(): void {
  if (_sqliteDb) {
    try { _sqliteDb.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) {}
    try { _sqliteDb.close(); } catch (e) {}
    _sqliteDb = null;
  }

  _sqliteDb = new Database(dbPath);
  _sqliteDb.exec('PRAGMA journal_mode = WAL');
  _sqliteDb.exec('PRAGMA busy_timeout = 5000');
  _sqliteDb.exec('PRAGMA foreign_keys = ON');

  createTables(_sqliteDb);
  runMigrations(_sqliteDb);
  runSeeds(_sqliteDb);
}

// ============================================================
// Initialize DB (Postgres or SQLite)
// ============================================================
if (USE_POSTGRES) {
  db = createPgDb();
} else {
  initSqliteDb();
  db = new Proxy({} as Database.Database, {
    get(_, prop: string | symbol) {
      if (!_sqliteDb) throw new Error('Database connection is not available (restore in progress?)');
      const val = (_sqliteDb as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === 'function' ? val.bind(_sqliteDb) : val;
    },
    set(_, prop: string | symbol, val: unknown) {
      (_sqliteDb as unknown as Record<string | symbol, unknown>)[prop] = val;
      return true;
    },
  }) as Database.Database;

  if (process.env.DEMO_MODE?.toLowerCase() === 'true') {
    try {
      const { seedDemoData } = require('../demo/demo-seed');
      seedDemoData(_sqliteDb);
    } catch (err: unknown) {
      console.error('[Demo] Seed error:', err instanceof Error ? err.message : err);
    }
  }
}

function closeDb(): void {
  if (USE_POSTGRES) {
    try { (db as ReturnType<typeof createPgDb>).close?.(); } catch (e) {}
    console.log('[DB] PostgreSQL pool closed');
    return;
  }
  if (_sqliteDb) {
    try { _sqliteDb.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) {}
    try { _sqliteDb.close(); } catch (e) {}
    _sqliteDb = null;
    console.log('[DB] SQLite connection closed');
  }
}

function reinitialize(): void {
  if (USE_POSTGRES) {
    console.log('[DB] PostgreSQL does not need reinitialization');
    return;
  }
  console.log('[DB] Reinitializing SQLite connection after restore...');
  if (_sqliteDb) closeDb();
  initSqliteDb();
  db = new Proxy({} as Database.Database, {
    get(_, prop: string | symbol) {
      if (!_sqliteDb) throw new Error('Database connection is not available (restore in progress?)');
      const val = (_sqliteDb as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === 'function' ? val.bind(_sqliteDb) : val;
    },
    set(_, prop: string | symbol, val: unknown) {
      (_sqliteDb as unknown as Record<string | symbol, unknown>)[prop] = val;
      return true;
    },
  }) as Database.Database;
  console.log('[DB] Database reinitialized successfully');
}

interface PlaceWithCategory extends Place {
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
}

interface PlaceWithTags extends Place {
  category: { id: number; name: string; color: string; icon: string } | null;
  tags: Tag[];
}

function getPlaceWithTags(placeId: number | string): PlaceWithTags | null {
  const place = (db as Database.Database).prepare(`
    SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM places p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(placeId) as PlaceWithCategory | undefined;

  if (!place) return null;

  const tags = (db as Database.Database).prepare(`
    SELECT t.* FROM tags t
    JOIN place_tags pt ON t.id = pt.tag_id
    WHERE pt.place_id = ?
  `).all(placeId) as Tag[];

  return {
    ...place,
    category: place.category_id ? {
      id: place.category_id,
      name: place.category_name!,
      color: place.category_color!,
      icon: place.category_icon!,
    } : null,
    tags,
  };
}

interface TripAccess {
  id: number;
  user_id: number;
}

function canAccessTrip(tripId: number | string, userId: number): TripAccess | undefined {
  return (db as Database.Database).prepare(`
    SELECT t.id, t.user_id FROM trips t
    LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
    WHERE t.id = ? AND (t.user_id = ? OR m.user_id IS NOT NULL)
  `).get(userId, tripId, userId) as TripAccess | undefined;
}

function isOwner(tripId: number | string, userId: number): boolean {
  return !!(db as Database.Database).prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, userId);
}

if (!USE_POSTGRES) {
  try {
    const { backfillFlightEndpoints } = require('../services/airportService');
    backfillFlightEndpoints();
  } catch (err) {
    console.error('[DB] Flight endpoint backfill failed:', err);
  }
}

export { db, closeDb, reinitialize, getPlaceWithTags, canAccessTrip, isOwner };
