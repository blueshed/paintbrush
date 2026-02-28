/**
 * Session store — cookie-based sessions backed by SQLite.
 *
 * Usage:
 *   const sessions = createSessionStore(db);
 *   provide("sessions", sessions);
 *
 *   // In a route handler:
 *   const session = await sessions.fromRequest(req);
 *   const res = new Response("ok");
 *   sessions.setCookie(res, session.id, 3600);
 */

import type { DatabaseInstance } from "./sqlite-store";

export interface Session {
  id: string;
  userId: string;
  role: string;
  data: Record<string, any>;
  expiresAt: number;
  createdAt: number;
}

export interface SessionStore {
  create(userId: string, role: string, ttlSeconds: number, data?: Record<string, any>): Promise<Session>;
  get(sessionId: string): Promise<Session | null>;
  destroy(sessionId: string): Promise<void>;
  touch(sessionId: string, ttlSeconds: number): Promise<void>;
  fromRequest(req: Request): Promise<Session | null>;
  setCookie(res: Response, sessionId: string, ttlSeconds: number): Response;
  clearCookie(res: Response): Response;
}

/** Default TTLs in seconds */
export const SESSION_TTL = {
  admin: 4 * 60 * 60,      // 4 hours
  guest: 30 * 24 * 60 * 60, // 30 days
} as const;

export function createSessionStore(db: DatabaseInstance): SessionStore {
  const store = db.sqliteStore<Session & { id: string }>("_sessions");
  const secure = process.env.NODE_ENV === "production";

  return {
    async create(userId, role, ttlSeconds, data = {}) {
      const now = Date.now();
      const session: Session = {
        id: crypto.randomUUID(),
        userId,
        role,
        data,
        expiresAt: now + ttlSeconds * 1000,
        createdAt: now,
      };
      await store.insert(session);
      return session;
    },

    async get(sessionId) {
      const session = await store.findById(sessionId);
      if (!session) return null;
      if (Date.now() > session.expiresAt) {
        await store.remove(sessionId);
        return null;
      }
      return session;
    },

    async destroy(sessionId) {
      await store.remove(sessionId);
    },

    async touch(sessionId, ttlSeconds) {
      await store.update(sessionId, {
        expiresAt: Date.now() + ttlSeconds * 1000,
      } as any);
    },

    fromRequest(req) {
      const cookie = req.headers.get("cookie");
      if (!cookie) return Promise.resolve(null);
      const match = cookie.match(/(?:^|;\s*)sid=([^\s;]+)/);
      if (!match) return Promise.resolve(null);
      return this.get(match[1]);
    },

    setCookie(res, sessionId, ttlSeconds) {
      const parts = [
        `sid=${sessionId}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${ttlSeconds}`,
      ];
      if (secure) parts.push("Secure");
      res.headers.append("Set-Cookie", parts.join("; "));
      return res;
    },

    clearCookie(res) {
      res.headers.append("Set-Cookie", "sid=; Path=/; HttpOnly; Max-Age=0");
      return res;
    },
  };
}
