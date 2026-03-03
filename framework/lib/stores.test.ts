import { describe, test, expect, afterEach } from "bun:test";
import { jsonFile, memoryStore } from "./stores";
import { unlinkSync } from "fs";

// ── memoryStore ──

describe("memoryStore", () => {
  test("reads empty by default", async () => {
    const store = memoryStore();
    expect(await store.read()).toEqual([]);
  });

  test("reads seeded data", async () => {
    const store = memoryStore([{ id: "1", name: "A" }]);
    expect(await store.read()).toEqual([{ id: "1", name: "A" }]);
  });

  test("write then read round-trips", async () => {
    const store = memoryStore<{ id: string; val: number }>();
    await store.write([{ id: "x", val: 42 }]);
    expect(await store.read()).toEqual([{ id: "x", val: 42 }]);
  });

  test("read returns a copy, not a reference", async () => {
    const store = memoryStore([{ id: "1" }]);
    const a = await store.read();
    const b = await store.read();
    expect(a).not.toBe(b);
  });
});

// ── jsonFile ──

const TMP = import.meta.dir + "/test-store.tmp.json";

describe("jsonFile", () => {
  afterEach(() => {
    try { unlinkSync(TMP); } catch {}
  });

  test("reads empty array when file does not exist", async () => {
    const store = jsonFile(TMP);
    expect(await store.read()).toEqual([]);
  });

  test("write then read round-trips", async () => {
    const store = jsonFile<{ id: string; label: string }>(TMP);
    await store.write([{ id: "a", label: "hello" }]);
    const items = await store.read();
    expect(items).toEqual([{ id: "a", label: "hello" }]);
  });

  test("overwrites previous data", async () => {
    const store = jsonFile<{ id: string }>(TMP);
    await store.write([{ id: "1" }, { id: "2" }]);
    await store.write([{ id: "3" }]);
    expect(await store.read()).toEqual([{ id: "3" }]);
  });

  test("persists to disk as formatted JSON", async () => {
    const store = jsonFile<{ id: string }>(TMP);
    await store.write([{ id: "check" }]);
    const raw = await Bun.file(TMP).text();
    expect(raw).toContain("\n");
    expect(JSON.parse(raw)).toEqual([{ id: "check" }]);
  });
});
