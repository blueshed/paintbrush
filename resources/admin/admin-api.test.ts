import { describe, test, expect, afterEach } from "bun:test";
import { buildRoutes } from "../../lib/decorators";
import { provide } from "../../lib/shared";
import { createDatabase } from "../../lib/sqlite-store";
import { Admin } from "./admin-api";
import { unlinkSync } from "fs";

const TMP = import.meta.dir + "/test-admin.tmp.db";

function cleanup() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { unlinkSync(TMP + suffix); } catch {}
  }
}

describe("Admin — backup", () => {
  afterEach(cleanup);

  test("GET /admin/backup returns binary with correct headers", async () => {
    const db = createDatabase(TMP);
    provide("db", db);
    const store = db.sqliteStore<{ id: string; val: string }>("things");
    await store.insert({ id: "1", val: "hello" });

    const routes = buildRoutes(Admin);
    const res = await routes["/admin/backup"].GET(new Request("http://test"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("app.db");
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBeGreaterThan(0);
    // SQLite files start with "SQLite format 3\0"
    const header = new TextDecoder().decode(body.slice(0, 15));
    expect(header).toBe("SQLite format 3");
  });
});

describe("Admin — restore", () => {
  afterEach(cleanup);

  test("POST /admin/restore overwrites database and returns success", async () => {
    const db = createDatabase(TMP);
    provide("db", db);
    const store = db.sqliteStore<{ id: string; val: string }>("things");
    await store.insert({ id: "1", val: "before" });

    const routes = buildRoutes(Admin);
    const backupRes = await routes["/admin/backup"].GET(new Request("http://test"));
    const snapshot = new Uint8Array(await backupRes.arrayBuffer());

    await store.insert({ id: "2", val: "extra" });

    const restoreReq = new Request("http://test", {
      method: "POST",
      body: snapshot,
    });
    const res = await routes["/admin/restore"].POST(restoreReq);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toBe("Database restored");
  });
});
