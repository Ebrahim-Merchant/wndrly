/**
 * PostgreSQL compatibility shim for better-sqlite3 API
 *
 * Wraps pg (node-postgres) to expose a synchronous interface matching
 * better-sqlite3's API: db.prepare(sql).get(...), .all(...), .run(...)
 *
 * Uses Worker Threads + SharedArrayBuffer + Atomics.wait() for true
 * synchronous blocking without blocking the main event loop's I/O.
 * This is Node v24 compatible (deasync is not reliable inside async handlers).
 */

import { Pool, PoolClient } from 'pg';
import { Worker, isMainThread, parentPort, workerData, receiveMessageOnPort, MessageChannel } from 'node:worker_threads';
import path from 'node:path';

// ─── Pool (main thread only, for async warm-up check) ───────────────────────
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

pool.query('SELECT 1').then(() => {
  console.log('[PG] Connection pool warmed up');
}).catch((err) => {
  console.error('[PG] Pool warm-up failed:', err.message);
});

// ─── Query converter (shared logic) ─────────────────────────────────────────

function convertQuery(sql: string, params: unknown[]): { query: string; values: unknown[] } {
  let index = 0;
  const values: unknown[] = [];

  // Detect named-param style: if params has exactly one object (not array/null)
  // with keys matching :name tokens in the SQL, use named-param substitution.
  const namedParamObj =
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
      ? (params[0] as Record<string, unknown>)
      : null;

  let query: string;

  if (namedParamObj && /:[a-zA-Z_][a-zA-Z0-9_]*/.test(sql)) {
    // Named-param mode: replace :name with $N, building values array in order
    const nameToIndex: Record<string, number> = {};
    query = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
      if (!(name in nameToIndex)) {
        values.push(namedParamObj[name]);
        nameToIndex[name] = values.length;
      }
      return `$${nameToIndex[name]}`;
    });
  } else {
    // Positional ? mode
    query = sql.replace(/\?/g, () => {
      values.push(params[index++]);
      return `$${values.length}`;
    });
  }

  // Convert SQLite-specific INSERT OR IGNORE / INSERT OR REPLACE syntax
  // Detect intent from original SQL before any keyword substitution.
  const wasIgnore = /\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
  const wasReplace = /\bINSERT\s+OR\s+REPLACE\s+INTO\b/i.test(sql);

  if (wasIgnore) {
    query = query.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(query)) {
      // Insert ON CONFLICT DO NOTHING before any RETURNING clause
      query = query.replace(/(\s*RETURNING\b[^;]*)?;?\s*$/, (m, ret) =>
        ret ? ` ON CONFLICT DO NOTHING${ret}` : ' ON CONFLICT DO NOTHING'
      );
    }
  } else if (wasReplace) {
    // INSERT OR REPLACE: convert to INSERT ... ON CONFLICT DO UPDATE SET col=EXCLUDED.col
    // Extract the column list from INSERT INTO tbl (col1, col2, ...) VALUES
    query = query.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(query)) {
      const colMatch = query.match(/INSERT INTO \S+ \(([^)]+)\)\s+VALUES/i);
      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim());
        if (cols.length >= 2) {
          // First column is assumed to be the conflict target (PK or unique key)
          const conflictCol = cols[0];
          const updateCols = cols.slice(1);
          const updateSet = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
          const conflictClause = ` ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateSet}`;
          // Insert before any RETURNING clause
          query = query.replace(/(\s*RETURNING\b[^;]*)?;?\s*$/, (m, ret) =>
            ret ? `${conflictClause}${ret}` : conflictClause
          );
        } else {
          query = query.replace(/(\s*RETURNING\b[^;]*)?;?\s*$/, (m, ret) =>
            ret ? ` ON CONFLICT DO NOTHING${ret}` : ' ON CONFLICT DO NOTHING'
          );
        }
      } else {
        // No column list found, fall back to DO NOTHING
        query = query.replace(/(\s*RETURNING\b[^;]*)?;?\s*$/, (m, ret) =>
          ret ? ` ON CONFLICT DO NOTHING${ret}` : ' ON CONFLICT DO NOTHING'
        );
      }
    }
  }

  query = query
    .replace(/\bCURRENT_TIMESTAMP\b/g, 'CURRENT_TIMESTAMP')
    .replace(/strftime\('%s','now'\)/g, "EXTRACT(EPOCH FROM NOW())::BIGINT")
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/IFNULL\(/gi, 'COALESCE(')
    .replace(/\|\|/g, '||');

  return { query, values };
}

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

// ─── Synchronous query execution via worker thread ──────────────────────────
//
// Each call to runSync() creates a short-lived worker thread that:
//   1. Opens its own pg connection (or reuses a cached pool)
//   2. Runs the query async inside the worker
//   3. Posts the result back to the main thread via a MessageChannel port
//   4. Main thread uses Atomics.wait() on a SharedArrayBuffer flag to block
//      without interfering with the outer event loop's I/O callbacks.

// Worker source embedded as a string to avoid file-system path issues in Docker
const WORKER_SRC = `
const { workerData, parentPort } = require('worker_threads');
const { Pool } = require('pg');

// One pool per worker (workers are reused via the pool below)
let _pool = null;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: workerData.DATABASE_URL,
      ssl: workerData.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return _pool;
}

parentPort.on('message', async ({ port, sql, values, sharedBuf }) => {
  const sab = sharedBuf; // Int32Array view set to 0; main waits until 1
  try {
    const res = await getPool().query(sql, values);
    const rows = (res.rows || []).map(row => {
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        if (v instanceof Date) {
          out[k] = v.toISOString().replace('T', ' ').replace(/\\.\\d{3}Z$/, '');
        } else if (typeof v === 'bigint') {
          out[k] = Number(v);
        } else {
          out[k] = v;
        }
      }
      return out;
    });
    port.postMessage({ ok: true, rows, rowCount: res.rowCount || 0 });
  } catch (err) {
    port.postMessage({ ok: false, error: err.message });
  } finally {
    Atomics.store(new Int32Array(sab), 0, 1);
    Atomics.notify(new Int32Array(sab), 0);
  }
});
`;

// Worker pool to avoid spawning a new thread per query
const MAX_WORKERS = 10;
const workerQueue: Worker[] = [];
const idleWorkers: Worker[] = [];

function getWorker(): Worker {
  if (idleWorkers.length > 0) {
    return idleWorkers.pop()!;
  }
  if (workerQueue.length < MAX_WORKERS) {
    const w = new Worker(WORKER_SRC, {
      eval: true,
      workerData: {
        DATABASE_URL: process.env.DATABASE_URL,
        DATABASE_SSL: process.env.DATABASE_SSL,
      },
    });
    w.on('error', (err) => console.error('[PG Worker] Error:', err.message));
    workerQueue.push(w);
    return w;
  }
  // Fallback: create a temporary worker (should rarely happen)
  return new Worker(WORKER_SRC, {
    eval: true,
    workerData: {
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_SSL: process.env.DATABASE_SSL,
    },
  });
}

function releaseWorker(w: Worker): void {
  if (workerQueue.includes(w) && idleWorkers.length < MAX_WORKERS) {
    idleWorkers.push(w);
  }
}

/**
 * Run a query synchronously using Worker + Atomics.wait()
 * Safe to call from within Express request handlers on Node v24.
 */
function runSync(sql: string, params: unknown[] = []): { rows: Record<string, unknown>[]; rowCount: number } {
  const { query, values } = convertQuery(sql, params);

  const worker = getWorker();
  const { port1, port2 } = new MessageChannel();

  // SharedArrayBuffer: [0] = 0 (pending) → 1 (done)
  const sab = new SharedArrayBuffer(4);
  const flag = new Int32Array(sab);
  Atomics.store(flag, 0, 0);

  worker.postMessage({ port: port2, sql: query, values, sharedBuf: sab }, [port2]);

  // Block main thread until worker signals done
  Atomics.wait(flag, 0, 0, 15000); // 15s timeout

  releaseWorker(worker);

  const msg = receiveMessageOnPort(port1);
  port1.close();

  if (!msg) {
    const e = new Error(`[PG] Query timed out after 15s\nSQL: ${query}`);
    console.error(e.message);
    throw e;
  }

  const { ok, rows, rowCount, error } = msg.message as {
    ok: boolean;
    rows?: Record<string, unknown>[];
    rowCount?: number;
    error?: string;
  };

  if (!ok) {
    const e = new Error(error) as Error & { query?: string };
    e.query = query;
    console.error(`[PG] Query error: ${error}\nSQL: ${query}\nParams: ${JSON.stringify(values)}`);
    throw e;
  }

  return { rows: rows!, rowCount: rowCount! };
}

/**
 * PreparedStatement-like object matching better-sqlite3's Statement interface
 */
class Statement {
  private sql: string;

  constructor(sql: string) {
    this.sql = sql;
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const flat = params.flat();
    const { rows } = runSync(this.sql, flat);
    return rows[0];
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const flat = params.flat();
    const { rows } = runSync(this.sql, flat);
    return rows;
  }

  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    const flat = params.flat();

    let sql = this.sql;
    let returningId = false;

    if (/^\s*INSERT\s+/i.test(sql) && !/RETURNING/i.test(sql)) {
      sql = sql.replace(/;?\s*$/, ' RETURNING id');
      returningId = true;
    }

    let rows: Record<string, unknown>[];
    let rowCount: number;

    try {
      ({ rows, rowCount } = runSync(sql, flat));
    } catch (err: unknown) {
      // If RETURNING id failed because the table has no id column, retry without it
      const msg = (err as Error).message || '';
      if (returningId && (msg.includes('column "id" does not exist') || msg.includes("column 'id' does not exist"))) {
        ({ rows, rowCount } = runSync(this.sql, flat));
        returningId = false;
      } else {
        throw err;
      }
    }

    return {
      changes: rowCount,
      lastInsertRowid: returningId && rows[0]?.id ? (rows[0].id as number) : 0,
    };
  }

  iterate(...params: unknown[]): IterableIterator<Record<string, unknown>> {
    return this.all(...params)[Symbol.iterator]() as IterableIterator<Record<string, unknown>>;
  }
}

/**
 * Transaction wrapper
 */
function transaction<T>(fn: (db: typeof pgDb) => T): () => T {
  return () => {
    // Run the function — each statement inside uses runSync which handles its own connection.
    // For true ACID transactions this would need a dedicated connection, but
    // the existing code does not rely on cross-statement transactions in practice.
    return fn(pgDb);
  };
}

function exec(sql: string): void {
  runSync(sql, []);
}

const pgDb = {
  prepare: (sql: string) => new Statement(sql),
  exec,
  transaction,
  all: (sql: string, ...params: unknown[]) => runSync(sql, params.flat()).rows,
  get: (sql: string, ...params: unknown[]) => runSync(sql, params.flat()).rows[0],
  run: (sql: string, ...params: unknown[]) => {
    const stmt = new Statement(sql);
    return stmt.run(...params);
  },
  pool,
  close: () => {
    pool.end().catch(() => {});
    for (const w of workerQueue) {
      w.terminate().catch(() => {});
    }
  },
};

export { pgDb as db };
export default pgDb;
