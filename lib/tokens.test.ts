import { describe, test, expect, beforeEach } from "bun:test";
import { createTokenStore } from "./tokens";
import { createDatabase } from "./sqlite-store";
import type { TokenStore } from "./tokens";

let tokens: TokenStore;

beforeEach(() => {
  const db = createDatabase(":memory:");
  tokens = createTokenStore(db);
});

describe("createTokenStore", () => {
  test("create returns a token string", async () => {
    const token = await tokens.create("user1", "guest", 3600);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  test("validate returns userId and role for valid token", async () => {
    const token = await tokens.create("user1", "guest", 3600);
    const result = await tokens.validate(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user1");
    expect(result!.role).toBe("guest");
  });

  test("validate returns null for unknown token", async () => {
    const result = await tokens.validate("nonexistent");
    expect(result).toBeNull();
  });

  test("token is single-use — second validate returns null", async () => {
    const token = await tokens.create("user1", "guest", 3600);
    const first = await tokens.validate(token);
    expect(first).not.toBeNull();
    const second = await tokens.validate(token);
    expect(second).toBeNull();
  });

  test("expired token returns null", async () => {
    const token = await tokens.create("user1", "guest", -1); // already expired
    const result = await tokens.validate(token);
    expect(result).toBeNull();
  });

  test("revoke removes a token", async () => {
    const token = await tokens.create("user1", "guest", 3600);
    await tokens.revoke(token);
    const result = await tokens.validate(token);
    expect(result).toBeNull();
  });

  test("listForUser returns active tokens only", async () => {
    const t1 = await tokens.create("user1", "guest", 3600);
    await tokens.create("user1", "guest", -1); // expired
    await tokens.create("user2", "guest", 3600); // different user
    const t4 = await tokens.create("user1", "admin", 3600);

    const list = await tokens.listForUser("user1");
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.id).sort()).toEqual([t1, t4].sort());
  });

  test("used token not listed for user", async () => {
    const token = await tokens.create("user1", "guest", 3600);
    await tokens.validate(token); // marks as used

    const list = await tokens.listForUser("user1");
    expect(list).toHaveLength(0);
  });
});
