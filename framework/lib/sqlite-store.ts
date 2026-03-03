/**
 * SQLite store — pluggable backing store using Bun's built-in SQLite.
 *
 * Usage:
 *   import { createDatabase } from "./sqlite";
 *
 *   const { sqliteStore, backup, restore } = createDatabase(
 *     process.env.DB_PATH ?? "./data/app.db"
 *   );
 *
 *   @Resource("/api/todos", sqliteStore("todos"), { notify: "todos" })
 *   class Todo { ... }
 *
 * All writes (store operations, backup, restore) flow through a single
 * write queue that drains within Bun's event loop. No write contention,
 * no SQLITE_BUSY, no locks to think about.
 *
 * Each store creates a table with (id TEXT PRIMARY KEY, data TEXT).
 * The `data` column holds the full item as JSON.
 *
 * Implements Store<T> (read/write) for drop-in compatibility,
 * plus granular methods (insert/update/remove/findById) that
 * buildRoutes can use when available.
 */

import { Database } from "bun:sqlite";
import { renameSync, unlinkSync, writeFileSync } from "fs";
import type { Store } from "./stores";
import { inject } from "./shared";

// ── Granular store interface ──

export interface GranularStore<T extends { id: string }> extends Store<T> {
  insert(item: T): Promise<T>;
  update(id: string, fields: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  findById(id: string): Promise<T | null>;
}

// ── Write queue ──

type WriteOp<T = any> = () => T;

interface Queued<T = any> {
  op: WriteOp<T>;
  resolve: (value: T) => void;
  reject: (err: any) => void;
}

function createWriteQueue() {
  const queue: Queued[] = [];
  let draining = false;

  async function drain() {
    if (draining) return;
    draining = true;
    while (queue.length > 0) {
      const batch = queue.splice(0, queue.length);
      for (const { op, resolve, reject } of batch) {
        try {
          resolve(op());
        } catch (err) {
          reject(err);
        }
      }
    }
    draining = false;
  }

  function enqueue<T>(op: WriteOp<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({ op, resolve, reject });
      queueMicrotask(drain);
    });
  }

  return { enqueue };
}

// ── Database factory ──

export function createDatabase(path: string) {
  let db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");

  const { enqueue } = createWriteQueue();
  let generation = 0;

  function sqliteStore<T extends { id: string }>(
    table: string,
  ): GranularStore<T> {
    if (!/^[a-zA-Z_]\w*$/.test(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }

    let gen = -1;
    let stmts: {
      all: ReturnType<Database["prepare"]>;
      get: ReturnType<Database["prepare"]>;
      insert: ReturnType<Database["prepare"]>;
      upsert: ReturnType<Database["prepare"]>;
      remove: ReturnType<Database["prepare"]>;
      clear: ReturnType<Database["prepare"]>;
    };

    function prepare() {
      if (gen === generation) return;
      db.run(
        `CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
      );
      stmts = {
        all: db.prepare(`SELECT data FROM "${table}"`),
        get: db.prepare(`SELECT data FROM "${table}" WHERE id = ?`),
        insert: db.prepare(`INSERT INTO "${table}" (id, data) VALUES (?, ?)`),
        upsert: db.prepare(
          `INSERT INTO "${table}" (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        ),
        remove: db.prepare(`DELETE FROM "${table}" WHERE id = ?`),
        clear: db.prepare(`DELETE FROM "${table}"`),
      };
      gen = generation;
    }

    prepare();

    return {
      // ── Store<T> interface (drop-in compatible) ──

      async read(): Promise<T[]> {
        prepare();
        return stmts.all.all().map((row: any) => JSON.parse(row.data));
      },

      async write(items: T[]): Promise<void> {
        return enqueue(() => {
          prepare();
          db.transaction(() => {
            stmts.clear.run();
            for (const item of items) {
              stmts.insert.run(item.id, JSON.stringify(item));
            }
          })();
        });
      },

      // ── Granular operations (all queued) ──

      async insert(item: T): Promise<T> {
        return enqueue(() => {
          prepare();
          stmts.insert.run(item.id, JSON.stringify(item));
          return item;
        });
      },

      async update(id: string, fields: Partial<T>): Promise<T | null> {
        return enqueue(() => {
          prepare();
          const row: any = stmts.get.get(id);
          if (!row) return null;
          const existing = JSON.parse(row.data) as T;
          const updated = { ...existing, ...fields, id };
          stmts.upsert.run(id, JSON.stringify(updated));
          return updated;
        });
      },

      async remove(id: string): Promise<boolean> {
        return enqueue(() => {
          prepare();
          const result = stmts.remove.run(id);
          return result.changes > 0;
        });
      },

      async findById(id: string): Promise<T | null> {
        prepare();
        const row: any = stmts.get.get(id);
        return row ? JSON.parse(row.data) : null;
      },
    };
  }

  // ── Backup: queued, waits for pending writes, returns serialised db ──

  function backup(): Promise<Uint8Array> {
    return enqueue(() => db.serialize());
  }

  // ── Restore: queued, replaces the file, reopens the connection ──

  function restore(data: Uint8Array): Promise<void> {
    return enqueue(() => {
      db.close();
      for (const suffix of ["-wal", "-shm"]) {
        try { unlinkSync(path + suffix); } catch {}
      }
      // Write to temp file then rename — new inode avoids macOS VNODE cache issue
      const tmp = path + ".restoring";
      writeFileSync(tmp, data);
      renameSync(tmp, path);
      db = new Database(path);
      db.exec("PRAGMA journal_mode = WAL");
      db.exec("PRAGMA busy_timeout = 5000");
      generation++;
    });
  }

  return { sqliteStore, backup, restore, enqueue };
}

export type DatabaseInstance = ReturnType<typeof createDatabase>;

// ── Lazy store factory ──
// Returns a thin wrapper at decoration time.
// Resolves inject("db") on first use (request time).

export function sqliteStore<T extends { id: string }>(
  table: string,
): GranularStore<T> {
  let inner: GranularStore<T> | null = null;
  function store(): GranularStore<T> {
    if (!inner) inner = inject<DatabaseInstance>("db").sqliteStore<T>(table);
    return inner;
  }
  return {
    async read() { return store().read(); },
    async write(items) { return store().write(items); },
    async insert(item) { return store().insert(item); },
    async update(id, fields) { return store().update(id, fields); },
    async remove(id) { return store().remove(id); },
    async findById(id) { return store().findById(id); },
  };
}
