# Paintbrush

Decorator-based routes and resources for Bun. TC39 stage-3 decorators.

## Commands

- `bun dev` — start server with hot reload
- `bun test` — run tests (25 tests, ~15ms)
- `bunx tsc --noEmit` — type-check
- `/add-resource` — skill: scaffolds a new resource (all files + wiring)

## Folder structure

- `server.ts` — Bun.serve() entry, WebSocket upgrade, imports resource classes
- `app.ts` — client: shared WebSocket, hash router, view dispatch
- `index.html` — HTML shell (Bun bundles app.ts via HTMLBundle)
- `styles.css` — all styles
- `lib/` — framework internals (decorators, stores, signals, utils)
- `resources/` — one group per resource: `{name}-api.ts`, `{name}.ts`, `{name}-views.ts`, `{name}.json`

## Key patterns

- **Resource class** (`resources/*-api.ts`): `@Resource` + `@Field` decorators define CRUD + validation + defaults
- **Client wrappers** (`resources/*.ts`): typed fetch functions + optional `connect{Name}(ws)` live signal store
- **Views** (`resources/*-views.ts`): render functions that return `Dispose | void`
- **Store interface**: `{ read(): Promise<T[]>, write(items: T[]): Promise<void> }` — `jsonFile()` for dev, `memoryStore()` for tests
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

## WebSocket protocol

Client sends `{ action: "opendoc"|"closedoc", resource: "topic" }`. Server subscribes/unsubscribes via Bun pub/sub. Server publishes `{ resource, action: "create"|"update"|"delete", ... }` after writes for resources with `notify` set. Topics are whitelisted from decorator metadata.

## Testing pattern

`buildRoutes()` returns plain handler functions. Tests call them with mock `Request` objects and `memoryStore()`. Mock `serverRef.current` with a `publish()` spy for WebSocket assertions.

## Metadata note

Bun 1.3.10 provides `context.metadata` but doesn't attach via `Symbol.metadata`. Decorators use a private `Symbol("paintbrush")`; `@Resource`/`@Controller` attach it to the class. `buildRoutes()` reads from there.
