/**
 * Token store — single-use magic link tokens backed by SQLite.
 *
 * Usage:
 *   const tokens = createTokenStore(db);
 *   provide("tokens", tokens);
 *
 *   // Admin creates an invite:
 *   const token = await tokens.create(userId, "guest", 30 * 24 * 3600);
 *   const link = `${BASE_URL}/login?token=${token}`;
 *
 *   // Guest clicks the link:
 *   const result = await tokens.validate(tokenId);
 *   // if result is truthy, create a session
 */

import type { DatabaseInstance } from "./sqlite-store";

interface Token {
  id: string;
  userId: string;
  role: string;
  used: number;
  expiresAt: number;
  createdAt: number;
}

export interface TokenStore {
  create(userId: string, role: string, ttlSeconds: number): Promise<string>;
  validate(tokenId: string): Promise<{ userId: string; role: string } | null>;
  revoke(tokenId: string): Promise<void>;
  listForUser(userId: string): Promise<Token[]>;
}

export function createTokenStore(db: DatabaseInstance): TokenStore {
  const store = db.sqliteStore<Token & { id: string }>("_tokens");

  return {
    async create(userId, role, ttlSeconds) {
      const now = Date.now();
      const token: Token = {
        id: crypto.randomUUID(),
        userId,
        role,
        used: 0,
        expiresAt: now + ttlSeconds * 1000,
        createdAt: now,
      };
      await store.insert(token);
      return token.id;
    },

    async validate(tokenId) {
      const token = await store.findById(tokenId);
      if (!token) return null;
      if (token.used) return null;
      if (Date.now() > token.expiresAt) {
        await store.remove(tokenId);
        return null;
      }
      // Mark as used (single-use)
      await store.update(tokenId, { used: 1 } as any);
      return { userId: token.userId, role: token.role };
    },

    async revoke(tokenId) {
      await store.remove(tokenId);
    },

    async listForUser(userId) {
      const all = await store.read();
      return all.filter((t) => t.userId === userId && !t.used && Date.now() < t.expiresAt);
    },
  };
}
