# Authentication & Sessions

Framework-level auth modules in `lib/`. Not used by the demo app, but wired in `server.ts` and ready to use.

## Quick start

```typescript
// Protected resource — only admins can access
@Auth("admin")
@Resource("/api/gifts", sqliteStore("gifts"))
class Gift {
  @Field({ required: true }) accessor name: string = "";
  @Field() accessor price: number = 0;
}

// Mixed controller — some routes protected, some public
@Controller
class Dashboard {
  @Auth("admin")
  @GET("/api/admin/stats")
  async stats(req: any) {
    return Response.json({ user: req.session.userId });
  }

  @GET("/api/public/health")
  async health() {
    return Response.json({ ok: true });
  }
}
```

## @Auth decorator

`@Auth(role?)` works on classes and methods.

- **On a `@Resource` class:** wraps all CRUD handlers (GET list, GET by id, POST, PUT, DELETE)
- **On a `@GET`/`@POST` method:** wraps that single endpoint
- **No role argument:** any authenticated user
- **With role:** must match `session.role`
- Returns **401** (no session) or **403** (wrong role)
- Attaches `req.session` for handlers to use

The decorator lives in `lib/decorators.ts`. `lib/auth.ts` re-exports it for convenience:

```typescript
import { Auth } from "./lib/auth";
// or
import { Auth } from "./lib/decorators";
```

## Session store (`lib/sessions.ts`)

Cookie-based sessions backed by SQLite via `sqliteStore("_sessions")`.

```typescript
import { createSessionStore, SESSION_TTL } from "./lib/sessions";

const sessions = createSessionStore(db);
```

### API

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(userId, role, ttlSeconds, data?) => Session` | New session with `crypto.randomUUID()` id |
| `get` | `(sessionId) => Session \| null` | Retrieve session (auto-removes if expired) |
| `destroy` | `(sessionId) => void` | Delete a session |
| `touch` | `(sessionId, ttlSeconds) => void` | Extend expiry |
| `fromRequest` | `(req) => Session \| null` | Parse `sid` cookie, return session |
| `setCookie` | `(res, sessionId, ttlSeconds) => Response` | Set `HttpOnly; SameSite=Lax; Secure` cookie |
| `clearCookie` | `(res) => Response` | Expire the `sid` cookie |

### Session shape

```typescript
interface Session {
  id: string;
  userId: string;
  role: string;
  data: Record<string, any>;
  expiresAt: number;
  createdAt: number;
}
```

### Default TTLs

- `SESSION_TTL.admin` — 4 hours
- `SESSION_TTL.guest` — 30 days

## Token store (`lib/tokens.ts`)

Single-use magic link tokens backed by SQLite via `sqliteStore("_tokens")`.

```typescript
import { createTokenStore } from "./lib/tokens";

const tokens = createTokenStore(db);

// Admin creates an invite link
const tokenId = await tokens.create(userId, "guest", 30 * 24 * 3600);
const link = `${BASE_URL}/login?token=${tokenId}`;

// Guest clicks the link
const result = await tokens.validate(tokenId);
if (result) {
  // result.userId, result.role — create a session
}
```

### API

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(userId, role, ttlSeconds) => string` | Returns token UUID |
| `validate` | `(tokenId) => { userId, role } \| null` | Checks expiry, marks as used (single-use) |
| `revoke` | `(tokenId) => void` | Hard delete |
| `listForUser` | `(userId) => Token[]` | Active (unused, unexpired) tokens |

## TOTP (`lib/totp.ts`)

Passwordless admin auth via authenticator apps. Uses `otpauth` + `qrcode` packages.

```typescript
import { generateSecret, verifyCode } from "./lib/totp";

// Enrollment: show QR to admin
const { secret, uri, qrDataUrl } = await generateSecret("MyApp", "admin@example.com");
// Store `secret` in user record, render `qrDataUrl` as <img src>

// Login: verify 6-digit code from authenticator app
const valid = verifyCode(secret, "123456"); // true/false, allows +/-1 window for clock drift
```

## Server wiring

Both stores are registered in `server.ts` at startup:

```typescript
const db = createDatabase(dbPath);
provide("db", db);
provide("sessions", createSessionStore(db));
provide("tokens", createTokenStore(db));
```

The `@Auth` decorator looks up sessions via `tryInject("sessions")` at request time — no import coupling between decorators and the session store.

## Testing

Auth tests use an in-memory database:

```typescript
beforeEach(() => {
  const db = createDatabase(":memory:");
  sessions = createSessionStore(db);
  provide("sessions", sessions);
  provide("server", null);
});
```

Build routes and call handlers directly with cookie headers:

```typescript
const session = await sessions.create("user1", "admin", 3600);
const res = await routes["/api/secrets"].GET(
  new Request("http://test", { headers: { cookie: `sid=${session.id}` } })
);
expect(res.status).toBe(200);
```
