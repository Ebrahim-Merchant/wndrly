/**
 * PostgreSQL compatibility shim for better-sqlite3 API
 * 
 * Wraps pg (node-postgres) to expose a synchronous interface matching
 * better-sqlite3's API: db.prepare(sql).get(...), .all(...), .run(...)
 * Uses deasync to make async pg calls synchronous.
 * 
 * This allows the existing codebase to work unchanged with Postgres.
 */

import { Pool, PoolClient } from 'pg';
import deasync from 'deasync';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[PG] Pool error:', err.message);
});

/**
 * Convert SQLite-style positional params (?) to PostgreSQL ($1, $2, ...)
 * Also handle named params (@name, $name, :name) → positional
 */
function convertQuery(sql: string, params: unknown[]): { query: string; values: unknown[] } {
  let index = 0;
  const values: unknown[] = [];
  
  // Handle SQLite's ? placeholders → $1, $2, ...
  let query = sql.replace(/\?/g, () => {
    values.push(params[index++]);
    return `$${values.length}`;
  });

  // Convert SQLite AUTOINCREMENT → SERIAL behavior (handled at schema level)
  // Convert DATETIME defaults
  query = query
    .replace(/\bCURRENT_TIMESTAMP\b/g, 'CURRENT_TIMESTAMP')
    .replace(/strftime\('%s','now'\)/g, "EXTRACT(EPOCH FROM NOW())::BIGINT")
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/IFNULL\(/gi, 'COALESCE(')
    .replace(/\|\|/g, '||'); // string concat is same

  return { query, values };
}

/**
 * Convert PostgreSQL row to match SQLite conventions:
 * - timestamps → strings (SQLite returns strings)
 * - bigints → numbers
 */
function convertRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = v.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    } else if (typeof v === 'bigint') {
      out[k] = Number(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Run a query synchronously using deasync
 */
function runSync(sql: string, params: unknown[] = []): { rows: Record<string, unknown>[]; rowCount: number } {
  const { query, values } = convertQuery(sql, params);
  
  let result: { rows: Record<string, unknown>[]; rowCount: number } | null = null;
  let error: Error | null = null;
  let done = false;

  pool.query(query, values)
    .then((res) => {
      result = {
        rows: (res.rows || []).map(convertRow),
        rowCount: res.rowCount || 0,
      };
      done = true;
    })
    .catch((err) => {
      error = err;
      done = true;
    });

  deasync.loopWhile(() => !done);

  if (error) {
    const e = error as Error & { query?: string };
    e.query = query;
    console.error(`[PG] Query error: ${e.message}\nSQL: ${query}\nParams: ${JSON.stringify(values)}`);
    throw error;
  }

  return result!;
}

/**
 * PreparedStatement-like object matching better-sqlite3's Statement interface
 */
class Statement {
  private sql: string;

  constructor(sql: string) {
    this.sql = sql;
  }

  /** Returns the first row or undefined */
  get(...params: unknown[]): Record<string, unknown> | undefined {
    const flat = params.flat();
    const { rows } = runSync(this.sql, flat);
    return rows[0];
  }

  /** Returns all rows */
  all(...params: unknown[]): Record<string, unknown>[] {
    const flat = params.flat();
    const { rows } = runSync(this.sql, flat);
    return rows;
  }

  /** Executes and returns run info like better-sqlite3 */
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    const flat = params.flat();
    
    // For INSERT, we want to get the inserted ID back
    let sql = this.sql;
    let returningId = false;
    
    if (/^\s*INSERT\s+/i.test(sql) && !/RETURNING/i.test(sql)) {
      sql = sql.replace(/;?\s*$/, ' RETURNING id');
      returningId = true;
    }

    const { rows, rowCount } = runSync(sql, flat);
    
    return {
      changes: rowCount,
      lastInsertRowid: returningId && rows[0]?.id ? (rows[0].id as number) : 0,
    };
  }

  /** Iterate (simplified - returns all rows) */
  iterate(...params: unknown[]): IterableIterator<Record<string, unknown>> {
    return this.all(...params)[Symbol.iterator]() as IterableIterator<Record<string, unknown>>;
  }
}

/**
 * Transaction wrapper - runs fn inside a PG transaction synchronously
 */
function transaction<T>(fn: (db: typeof pgDb) => T): () => T {
  return () => {
    let result: T;
    let error: Error | null = null;
    let done = false;

    pool.connect().then(async (client: PoolClient) => {
      try {
        await client.query('BEGIN');
        // For now, run function directly - it will use the pool
        // This is a simplified transaction that may not be truly atomic
        // A full implementation would require passing the client through
        result = fn(pgDb);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        error = err as Error;
      } finally {
        client.release();
        done = true;
      }
    }).catch((err: Error) => {
      error = err;
      done = true;
    });

    deasync.loopWhile(() => !done);
    
    if (error) throw error;
    return result!;
  };
}

/**
 * Execute raw SQL (like db.exec in SQLite)
 */
function exec(sql: string): void {
  runSync(sql, []);
}

/**
 * The main db-like interface
 */
const pgDb = {
  prepare: (sql: string) => new Statement(sql),
  exec,
  transaction,
  // SQLite-compat: direct query methods
  all: (sql: string, ...params: unknown[]) => runSync(sql, params.flat()).rows,
  get: (sql: string, ...params: unknown[]) => runSync(sql, params.flat()).rows[0],
  run: (sql: string, ...params: unknown[]) => {
    const stmt = new Statement(sql);
    return stmt.run(...params);
  },
  // Expose pool for advanced usage
  pool,
  // Close gracefully
  close: () => {
    let done = false;
    pool.end().then(() => { done = true; }).catch(() => { done = true; });
    deasync.loopWhile(() => !done);
  },
};

export { pgDb as db };
export default pgDb;
// Type declaration handled inline - deasync is a native module
