import { describe, test, expect, beforeEach } from "bun:test";
import { createSessionStore, SESSION_TTL } from "./sessions";
import { createDatabase } from "./sqlite-store";
import type { SessionStore } from "./sessions";

let sessions: SessionStore;

beforeEach(() => {
  const db = createDatabase(":memory:");
  sessions = createSessionStore(db);
});

describe("createSessionStore", () => {
  test("create returns a session with correct fields", async () => {
    const session = await sessions.create("user1", "admin", 3600);
    expect(session.id).toBeTruthy();
    expect(session.userId).toBe("user1");
    expect(session.role).toBe("admin");
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(session.createdAt).toBeLessThanOrEqual(Date.now());
  });

  test("get retrieves a valid session", async () => {
    const created = await sessions.create("user1", "guest", 3600);
    const retrieved = await sessions.get(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.userId).toBe("user1");
    expect(retrieved!.role).toBe("guest");
  });

  test("get returns null for unknown session", async () => {
    const result = await sessions.get("nonexistent");
    expect(result).toBeNull();
  });

  test("get returns null and removes expired session", async () => {
    const created = await sessions.create("user1", "guest", -1); // already expired
    const result = await sessions.get(created.id);
    expect(result).toBeNull();
  });

  test("destroy removes a session", async () => {
    const created = await sessions.create("user1", "admin", 3600);
    await sessions.destroy(created.id);
    const result = await sessions.get(created.id);
    expect(result).toBeNull();
  });

  test("touch extends session expiry", async () => {
    const created = await sessions.create("user1", "guest", 60); // 1 minute
    const originalExpiry = created.expiresAt;
    await sessions.touch(created.id, 7200); // extend to 2 hours
    const refreshed = await sessions.get(created.id);
    expect(refreshed).not.toBeNull();
    expect(refreshed!.expiresAt).toBeGreaterThan(originalExpiry);
  });

  test("fromRequest parses cookie and returns session", async () => {
    const created = await sessions.create("user1", "admin", 3600);
    const req = new Request("http://test", {
      headers: { cookie: `sid=${created.id}` },
    });
    const session = await sessions.fromRequest(req);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("user1");
  });

  test("fromRequest returns null when no cookie", async () => {
    const req = new Request("http://test");
    const session = await sessions.fromRequest(req);
    expect(session).toBeNull();
  });

  test("fromRequest returns null when cookie has no sid", async () => {
    const req = new Request("http://test", {
      headers: { cookie: "other=value" },
    });
    const session = await sessions.fromRequest(req);
    expect(session).toBeNull();
  });

  test("fromRequest handles cookie with multiple values", async () => {
    const created = await sessions.create("user1", "guest", 3600);
    const req = new Request("http://test", {
      headers: { cookie: `theme=dark; sid=${created.id}; lang=en` },
    });
    const session = await sessions.fromRequest(req);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("user1");
  });

  test("setCookie sets HttpOnly cookie on response", () => {
    const res = new Response("ok");
    sessions.setCookie(res, "test-session-id", 3600);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("sid=test-session-id");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=3600");
  });

  test("clearCookie sets Max-Age=0", () => {
    const res = new Response("ok");
    sessions.clearCookie(res);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("Max-Age=0");
  });
});

describe("SESSION_TTL", () => {
  test("admin TTL is 4 hours", () => {
    expect(SESSION_TTL.admin).toBe(4 * 60 * 60);
  });

  test("guest TTL is 30 days", () => {
    expect(SESSION_TTL.guest).toBe(30 * 24 * 60 * 60);
  });
});
