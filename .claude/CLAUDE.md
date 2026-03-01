# Paintbrush

Decorator-based routes and resources for Bun. TC39 stage-3 decorators.

## Commands

- `bun run demo` — run the full demo app
- `bun run zero` — run the minimal starter
- `bun dev` — run the initialized project (after `/init-paint`)
- `bun test` — run tests
- `bunx tsc --noEmit` — type-check
- `/init-paint` — skill: initialize root app files from zero/ or demo/
- `/add-resource` — skill: scaffolds a new resource (all files + wiring)

## Project layout (after `/init-paint`)

```
server.ts          — Bun.serve() entry: routes, imports resource classes
app.ts             — client: hash router, view dispatch
index.html         — HTML shell (Bun bundles app.ts via HTMLBundle)
styles.css         — all styles
resources/         — one subfolder per resource
  home-view.ts     — home page with nav links
  {name}s/         — resource subfolder (created by /add-resource)
    {name}s-api.ts — @Resource + @Field class
    {name}s.ts     — client fetch wrappers
    {name}s-views.ts — list + detail views
lib/               — framework (do not edit)
demo/              — full demo app (reference)
zero/              — minimal starter (reference)
docs/              — reference docs
```

## Template layout (before `/init-paint`)

- `demo/` — full demo app (notes, todos, checklists, admin):
  - `server.ts`, `app.ts`, `index.html`, `styles.css`
  - `resources/` — demo resources (mirrors project layout)
    - `home-view.ts`, `notes/`, `todos/`, `checklists/`, `admin/`
- `zero/` — minimal starter (single editable message):
  - `server.ts`, `app.ts`, `index.html`, `styles.css`
  - `resources/` — `message-api.ts`, `message.json`
- `lib/` — framework internals:
  - `decorators.ts` — `@Resource`, `@Field`, `@Auth`, `@Controller`, `@GET`/`@POST`/`@PUT`/`@DELETE`, `buildRoutes()`
  - `auth.ts` — re-exports `@Auth` from decorators
  - `sessions.ts` — `createSessionStore(db)`: cookie-based sessions backed by SQLite
  - `tokens.ts` — `createTokenStore(db)`: single-use magic link tokens backed by SQLite
  - `totp.ts` — `generateSecret()`, `verifyCode()`: TOTP for passwordless admin auth
  - `stores.ts` — `Store<T>` interface, `memoryStore()`, `jsonFile()`
  - `sqlite-store.ts` — `createDatabase()`, `GranularStore<T>`, lazy `sqliteStore()` factory, backup/restore
  - `shared.ts` — `provide`/`inject`/`tryInject` named resource registry
  - `signals.ts` — `Signal`, `routes()` hash router, `navigate()`
  - `utils.ts` — `esc()` HTML escaping, `notFoundView()`
  - `reconnecting-ws.ts` — auto-reconnecting WebSocket with resubscribe
- `docs/` — reference docs: `railway.md` (deployment), `auth.md` (sessions, tokens, TOTP), `cqrs.md` (document pattern)

## Key patterns

- **Resource class** (`{name}s-api.ts`): `@Resource` + `@Field` decorators define CRUD + validation + defaults
- **Client wrappers** (`{name}s.ts`): typed fetch functions + optional `connect{Name}(ws)` live signal store
- **Views** (`{name}s-views.ts`): render functions that return `Dispose | void`
- **Store interface**: `{ read(): Promise<T[]>, write(items: T[]): Promise<void> }` — `jsonFile()` for JSON files, `memoryStore()` for tests, `sqliteStore()` for SQLite
- **GranularStore**: extends Store with `insert`, `update`, `remove`, `findById` — `buildRoutes()` uses these when available
- **Shared registry** (`lib/shared.ts`): `provide(name, value)` to register, `inject<T>(name)` to retrieve (throws), `tryInject<T>(name)` for optional lookup
- **WebSocket**: single shared connection in app.ts, multiplexed via `opendoc`/`closedoc` messages
- **Signals**: `Signal<Map<id, Signal<T>>>` — outer tracks membership, inner tracks fields
- **Event delegation**: list click handlers on `<ul>`, not per-`<li>`
- **Cancelled guards**: async views check a `cancelled` flag in `.then()` to prevent stale renders

## Decorators

- `@Resource(path, store, opts?)` — class: CRUD resource. `opts.notify` enables WebSocket pub/sub.
- `@Field(opts?)` — auto-accessor: `required`, `readonly`
- `@Auth(role?)` — class/method: requires authentication. No role = any authenticated user; with role = must match `session.role`. Returns 401/403. Attaches `req.session`.
- `@Controller` — class: attaches route metadata for non-resource classes
- `@GET(path)`, `@POST`, `@PUT`, `@DELETE` — method: custom endpoints
- `buildRoutes(...classes)` — reads metadata, returns route object for Bun.serve(). Wraps auth-decorated handlers.

## Stores

- `jsonFile(path)` — read/write JSON array to file. Used by notes, todos.
- `memoryStore(initial?)` — in-memory, for tests.
- `sqliteStore(table)` — lazy factory: defers `inject("db")` until first request. Used by checklists.
- `createDatabase(path)` — creates SQLite connection with WAL mode, write queue, backup/restore. Called in demo/server.ts, registered via `provide("db", ...)`.

## Authentication

Sessions, tokens, and TOTP modules live in `lib/` but are not used by the demo resources. See [`docs/auth.md`](../docs/auth.md) for full API reference. The `@Auth` decorator is documented above in Decorators.

## Server bootstrap (demo)

```
provide("db", createDatabase(dbPath))  →  Bun.serve({ routes: { ... } })  →  provide("server", server)
```

Apps using `@Auth` also need: `provide("sessions", createSessionStore(db))` and `provide("tokens", createTokenStore(db))` before `Bun.serve()`. See [`docs/auth.md`](../docs/auth.md).

Resources use `sqliteStore(table)` at decoration time (lazy — no db access until first request). The server ref is available via `tryInject("server")` for WebSocket publish in CRUD handlers.

## WebSocket protocol

Client sends `{ action: "opendoc"|"closedoc", resource: "topic" }`. Server subscribes/unsubscribes via Bun pub/sub. Server publishes `{ resource, action: "create"|"update"|"delete", ... }` after writes for resources with `notify` set. Topics are whitelisted from decorator metadata.

## Admin controller (demo)

`@Controller` class with custom endpoints:
- `GET /api/stats` — health/stats check
- `GET /admin/backup` — downloads serialised SQLite database
- `POST /admin/restore` — uploads and replaces the database (live, no restart needed)

Restore uses a generation counter so all stores re-prepare their SQLite statements on next use. File replacement uses temp-file + rename to avoid macOS VNODE cache issues.

## Testing pattern

`buildRoutes()` returns plain handler functions. Tests call them with mock `Request` objects and `memoryStore()`. Use `provide("server", { publish: spy })` for WebSocket assertions. Use `provide("db", createDatabase(":memory:"))` for SQLite-backed tests. Auth tests use `provide("sessions", createSessionStore(db))` with in-memory db to test `@Auth` wrapping.

## Metadata note

Bun 1.3.10 provides `context.metadata` but doesn't attach via `Symbol.metadata`. Decorators use a private `Symbol("paintbrush")`; `@Resource`/`@Controller` attach it to the class. `buildRoutes()` reads from there.
