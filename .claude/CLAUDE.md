# Paintbrush

Decorator-based routes and resources for Bun. TC39 stage-3 decorators.

## Commands

- `bun dev` — start server with hot reload
- `bun test` — run tests (41 tests across 4 files, ~60ms)
- `bunx tsc --noEmit` — type-check
- `/add-resource` — skill: scaffolds a new resource (all files + wiring)

## Folder structure

- `server.ts` — Bun.serve() entry: routes, WebSocket upgrade, imports resource classes. No fetch handler.
- `app.ts` — client: shared WebSocket, hash router, view dispatch. Purely imports + wiring.
- `index.html` — HTML shell (Bun bundles app.ts via HTMLBundle)
- `styles.css` — all styles
- `bunfig.toml` — test config (`root = "."` for recursive test discovery)
- `lib/` — framework internals:
  - `decorators.ts` — `@Resource`, `@Field`, `@Controller`, `@GET`/`@POST`/`@PUT`/`@DELETE`, `buildRoutes()`
  - `stores.ts` — `Store<T>` interface, `memoryStore()`, `jsonFile()`
  - `sqlite-store.ts` — `createDatabase()`, `GranularStore<T>`, lazy `sqliteStore()` factory, backup/restore
  - `shared.ts` — `provide`/`inject`/`tryInject` named resource registry
  - `signals.ts` — `Signal`, `routes()` hash router, `navigate()`
  - `utils.ts` — `esc()` HTML escaping, `notFoundView()`
- `resources/` — one subfolder per resource:
  - `notes/` — `notes-api.ts`, `notes.ts`, `notes-views.ts`, `notes.json`
  - `todos/` — `todos-api.ts`, `todos.ts`, `todos-views.ts`, `todos.json`
  - `checklists/` — `checklists-api.ts`, `checklists.ts`, `checklists-views.ts`
  - `admin/` — `admin-api.ts`, `admin-api.test.ts`, `admin-views.ts`
  - `home-view.ts` — home page with nav links

## Key patterns

- **Resource class** (`resources/*/\*-api.ts`): `@Resource` + `@Field` decorators define CRUD + validation + defaults
- **Client wrappers** (`resources/*/*.ts`): typed fetch functions + optional `connect{Name}(ws)` live signal store
- **Views** (`resources/*/*-views.ts`): render functions that return `Dispose | void`
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
- `@Controller` — class: attaches route metadata for non-resource classes
- `@GET(path)`, `@POST`, `@PUT`, `@DELETE` — method: custom endpoints
- `buildRoutes(...classes)` — reads metadata, returns route object for Bun.serve()

## Stores

- `jsonFile(path)` — read/write JSON array to file. Used by notes, todos.
- `memoryStore(initial?)` — in-memory, for tests.
- `sqliteStore(table)` — lazy factory: defers `inject("db")` until first request. Used by checklists.
- `createDatabase(path)` — creates SQLite connection with WAL mode, write queue, backup/restore. Called in server.ts, registered via `provide("db", ...)`.

## Server bootstrap

```
provide("db", createDatabase(dbPath))  →  Bun.serve({ routes: { ... } })  →  provide("server", server)
```

Resources use `sqliteStore(table)` at decoration time (lazy — no db access until first request). The server ref is available via `tryInject("server")` for WebSocket publish in CRUD handlers.

## WebSocket protocol

Client sends `{ action: "opendoc"|"closedoc", resource: "topic" }`. Server subscribes/unsubscribes via Bun pub/sub. Server publishes `{ resource, action: "create"|"update"|"delete", ... }` after writes for resources with `notify` set. Topics are whitelisted from decorator metadata.

## Admin controller

`@Controller` class with custom endpoints:
- `GET /api/stats` — health/stats check
- `GET /admin/backup` — downloads serialised SQLite database
- `POST /admin/restore` — uploads and replaces the database (live, no restart needed)

Restore uses a generation counter so all stores re-prepare their SQLite statements on next use. File replacement uses temp-file + rename to avoid macOS VNODE cache issues.

## Testing pattern

`buildRoutes()` returns plain handler functions. Tests call them with mock `Request` objects and `memoryStore()`. Use `provide("server", { publish: spy })` for WebSocket assertions. Use `provide("db", createDatabase(":memory:"))` for SQLite-backed tests.

## Metadata note

Bun 1.3.10 provides `context.metadata` but doesn't attach via `Symbol.metadata`. Decorators use a private `Symbol("paintbrush")`; `@Resource`/`@Controller` attach it to the class. `buildRoutes()` reads from there.
