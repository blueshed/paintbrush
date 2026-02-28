import { describe, test, expect, afterEach } from "bun:test";
import { createDatabase } from "./sqlite-store";
import { unlinkSync } from "fs";

const TMP = import.meta.dir + "/test-sqlite.tmp.db";

function cleanup() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { unlinkSync(TMP + suffix); } catch {}
  }
}

// ── Store basics ──

describe("sqliteStore", () => {
  afterEach(cleanup);

  test("read returns empty array for new table", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore("items");
    expect(await store.read()).toEqual([]);
  });

  test("write then read round-trips", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string; name: string }>("items");
    await store.write([{ id: "1", name: "A" }]);
    expect(await store.read()).toEqual([{ id: "1", name: "A" }]);
  });

  test("write overwrites previous data", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string }>("items");
    await store.write([{ id: "1" }, { id: "2" }]);
    await store.write([{ id: "3" }]);
    expect(await store.read()).toEqual([{ id: "3" }]);
  });

  test("insert adds a single item", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string; val: number }>("items");
    const item = await store.insert({ id: "a", val: 1 });
    expect(item).toEqual({ id: "a", val: 1 });
    expect(await store.read()).toEqual([{ id: "a", val: 1 }]);
  });

  test("insert throws on duplicate id", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string }>("items");
    await store.insert({ id: "dup" });
    expect(store.insert({ id: "dup" })).rejects.toThrow();
  });

  test("update merges fields and returns updated item", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string; name: string; status: string }>("items");
    await store.insert({ id: "1", name: "A", status: "draft" });
    const updated = await store.update("1", { status: "done" });
    expect(updated).toEqual({ id: "1", name: "A", status: "done" });
  });

  test("update returns null for missing id", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string }>("items");
    expect(await store.update("nope", {})).toBeNull();
  });

  test("remove deletes item and returns true", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string }>("items");
    await store.insert({ id: "x" });
    expect(await store.remove("x")).toBe(true);
    expect(await store.read()).toEqual([]);
  });

  test("remove returns false for missing id", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string }>("items");
    expect(await store.remove("nope")).toBe(false);
  });

  test("findById returns item or null", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const store = sqliteStore<{ id: string; name: string }>("items");
    await store.insert({ id: "f", name: "Found" });
    expect(await store.findById("f")).toEqual({ id: "f", name: "Found" });
    expect(await store.findById("missing")).toBeNull();
  });

  test("rejects invalid table names", () => {
    const { sqliteStore } = createDatabase(TMP);
    expect(() => sqliteStore("drop table;")).toThrow("Invalid table name");
  });

  test("multiple stores share one database", async () => {
    const { sqliteStore } = createDatabase(TMP);
    const a = sqliteStore<{ id: string }>("alpha");
    const b = sqliteStore<{ id: string }>("beta");
    await a.insert({ id: "1" });
    await b.insert({ id: "2" });
    expect(await a.read()).toEqual([{ id: "1" }]);
    expect(await b.read()).toEqual([{ id: "2" }]);
  });
});

// ── Backup / restore ──

describe("backup / restore", () => {
  afterEach(cleanup);

  test("backup returns a Uint8Array", async () => {
    const { sqliteStore, backup } = createDatabase(TMP);
    const store = sqliteStore<{ id: string }>("items");
    await store.insert({ id: "snap" });
    const data = await backup();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.byteLength).toBeGreaterThan(0);
  });

  test("restore overwrites the database file", async () => {
    const db1 = createDatabase(TMP);
    const store1 = db1.sqliteStore<{ id: string }>("items");
    await store1.insert({ id: "original" });
    const snapshot = await db1.backup();

    await store1.insert({ id: "extra" });
    expect(await store1.read()).toHaveLength(2);

    await db1.restore(snapshot);

    // Verify the file on disk matches the snapshot
    const fileData = new Uint8Array(await Bun.file(TMP).arrayBuffer()) as Uint8Array;
    expect(fileData).toEqual(snapshot as Uint8Array);
  });
});
