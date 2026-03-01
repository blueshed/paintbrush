<p align="center">
  <img src="docs/logo.svg" alt="Paintbrush" width="200" />
</p>

# Paintbrush

A decorator-based resource framework for [Bun](https://bun.sh). Define a class, get CRUD routes, real-time sync, and a reactive client — no dependencies beyond Bun.

```ts
@Resource("/api/todos", jsonFile("./todos.json"), { notify: "todos" })
class Todo {
  @Field({ required: true }) accessor title: string = "";
  @Field() accessor status: string = "pending";
  @Field({ readonly: true }) accessor createdAt: string = "";
  id: string = "";
}
```

That class generates five REST endpoints, field validation, default values, and WebSocket broadcasts on every write. The client subscribes with a single function call and gets a signal-per-entity reactive store.

## Quick start

Requires [Bun](https://bun.sh) 1.3.10+ (TC39 stage-3 decorator support).

```sh
bun create blueshed/paintbrush myapp
cd myapp
```

This runs `bun zero` — the minimal starter with a single editable message. Two starter apps are included:

| Command | What it runs |
|---|---|
| `bun run zero` | Minimal app — one editable JSON message, no database |
| `bun run demo` | Full app — notes, todos, checklists, admin, SQLite, real-time sync |

Try the demo: run `bun run demo`, then open two tabs to `http://localhost:3000/#/todos`. Create a todo in one — it appears live in the other.

### Building your own app

Using [Claude Code](https://claude.com/claude-code)? Type `/init-paint` to set up root-level app files from either starter, then `/add-resource` to scaffold resources with all files and wiring. After init, use `bun dev` to run your app.

## What it does

**Server side:** `@Resource` + `@Field` decorators generate a full CRUD API. `buildRoutes()` reads decorator metadata and returns a plain route object for `Bun.serve()`. Resources that opt into `{ notify: "topic" }` publish changes over Bun's built-in pub/sub.

**Client side:** `connectTodos(ws)` returns a `Signal<Map<id, Signal<Todo>>>`. The outer signal tracks list membership. Inner signals track individual fields. DOM updates are surgical — changing a todo's status only touches that one `<li>`.

**WebSocket protocol:** One shared WebSocket, multiplexed with `opendoc`/`closedoc`:

```
Client → { "action": "opendoc",  "resource": "todos" }
Client → { "action": "closedoc", "resource": "todos" }
Server → { "resource": "todos", "action": "create", "item": { ... } }
Server → { "resource": "todos", "action": "update", "id": "abc", "fields": { ... } }
Server → { "resource": "todos", "action": "delete", "id": "abc" }
```

Resources without `notify` (like Notes) are REST-only. The server validates topic names against a whitelist built from decorator metadata.

## Decorators

| Decorator | Target | Purpose |
|---|---|---|
| `@Resource(path, store, opts?)` | class | Declares a CRUD resource. `opts.notify` enables WebSocket broadcasts. |
| `@Field(opts?)` | auto-accessor | Declares a field. `required: true` validates on POST. `readonly: true` strips from PUT. |
| `@Auth(role?)` | class/method | Requires authentication. Optional role check. |
| `@Controller` | class | Attaches route metadata for non-resource classes. |
| `@GET(path)` | method | Custom endpoint. Also `@POST`, `@PUT`, `@DELETE`. |

## Store interface

```ts
interface Store<T extends { id: string }> {
  read(): Promise<T[]>;
  write(items: T[]): Promise<void>;
}
```

Three built-in stores: `jsonFile(path)` for JSON files, `sqliteStore(table)` for SQLite (with WAL mode, write queue, backup/restore), and `memoryStore()` for tests. The interface is two methods — implement it for Postgres, S3, whatever. The resource class doesn't know or care.

## Adding a resource

1. **Define the class** in `resources/things/things-api.ts` with `@Resource` and `@Field`
2. **Create client wrappers** in `resources/things/things.ts` (typed fetch functions, optionally a `connectThings(ws)` live store)
3. **Create views** in `resources/things/things-views.ts`
4. **Create** `resources/things/things.json` with `[]` (for JSON storage)
5. **Register** in `server.ts`: add to `buildRoutes(Note, Todo, Thing)`
6. **Add routes** in `app.ts`: add entries to the hash router

Or use `/add-resource` in Claude Code to generate all files and wiring automatically.

## Project structure

After `/init-paint`, your project looks like this:

```
server.ts              Entry point: Bun.serve(), WebSocket upgrade
app.ts                 Client: shared WebSocket, hash router
index.html             HTML shell (Bun bundles app.ts)
styles.css
resources/
  home-view.ts         Home page with nav links
  things/
    things-api.ts      @Resource + @Field class
    things.ts          Client fetch wrappers + live store
    things-views.ts    List + detail views
lib/                   Framework (do not edit)
  decorators.ts        @Resource, @Field, @Controller, @GET, buildRoutes
  stores.ts            Store interface, jsonFile(), memoryStore()
  sqlite-store.ts      sqliteStore(), createDatabase(), backup/restore
  signals.ts           Signal, routes(), navigate()
  utils.ts             esc() HTML escaping
  reconnecting-ws.ts   Auto-reconnecting WebSocket
demo/                  Full demo app (reference)
zero/                  Minimal starter (reference)
docs/                  Reference docs
```

## Tests

```sh
bun test
```

77 tests across 8 files, ~100ms. Tests call `buildRoutes()` directly with `memoryStore()` and mock `Request` objects — no server needed.

## Design decisions

- **TC39 stage-3 decorators**, not legacy/experimental. Bun 1.3.10+ supports them natively.
- **No virtual DOM.** Signals drive targeted `innerHTML` updates per entity. Event delegation on lists, not per-item listeners.
- **No framework dependency.** The signal system is ~150 lines. The decorator system is ~215 lines.
- **REST stays the write path.** WebSocket is notification-only. Clients write via fetch, receive updates via pub/sub. No conflict resolution needed.
- **Subscribe after load.** The client populates initial state from REST before subscribing to WebSocket updates, preventing race conditions.

## License

MIT
