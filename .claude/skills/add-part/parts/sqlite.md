# SQLite

When: the site stores records that must survive a restart and one JSON file no longer fits: a list that grows, or data to query. Use the built-in `bun:sqlite`; never install a SQLite package. If the data is a live document that several people edit, graduate delta's backend instead (the `delta-doc` skill) and keep the browser code as it is.

- `.gitignore`: `*.db`, `*.db-wal`, `*.db-shm`
- `src/db.ts`. The path comes from `DB_PATH`, else the project root (from `import.meta.dir`, never the working directory, so it is the same under `bun dev` and `serve:dist`):

```ts
import { Database } from "bun:sqlite";

export function createDatabase(path = process.env.DB_PATH ?? `${import.meta.dir}/../data.db`) {
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL)");
  return db;
}
```

- A resource whose routes take the database, in `src/resources/items/api.ts` (with a store and view as in "Adding a resource"):

```ts
import type { Database } from "bun:sqlite";

export type Item = { id: number; text: string };

export function itemsRoutes(db: Database) {
  return {
    "/api/items": {
      GET: () => Response.json(db.query("SELECT id, text FROM items ORDER BY id").all()),

      POST: async (req: Request) => {
        const body = await req.json().catch(() => null);
        if (typeof body?.text !== "string") return Response.json({ error: "text must be a string" }, { status: 400 });
        db.query("INSERT INTO items (text) VALUES (?)").run(body.text);
        return new Response(null, { status: 201 });
      },
    },
  };
}
```

- `src/server.ts` takes the database as an option, so tests can pass `:memory:`: add `import { createDatabase } from "./db";` and `import { itemsRoutes } from "./resources/items/api";`, a `db = createDatabase()` option next to `dataDir`, and `...itemsRoutes(db)` in `routes`.
- Tests: start the test server with `startServer({ port: 0, dev: false, dataDir, db: createDatabase(":memory:") })`. In `spawnServer`'s `env`, add `DB_PATH: ":memory:"`, so a spawned server never creates a real `data.db`. Then, one test per route and method, with the 400:

```ts
test("items are stored and listed", async () => {
  const post = await api("/api/items", { method: "POST", body: JSON.stringify({ text: "first" }) });
  expect(post.status).toBe(201);
  expect(await (await api("/api/items")).json()).toEqual([{ id: 1, text: "first" }]);
});

test("POST /api/items refuses a body that is not text", async () => {
  for (const body of ["not json", "{}"]) {
    expect((await api("/api/items", { method: "POST", body })).status).toBe(400);
  }
});
```

The "not json" body is not decoration: `.catch(() => null)` is a function, and `bun test` fails below 100% of functions, so a route's test must send the body that reaches it.

- On Railway the container's disk is wiped on every deploy: put the database on the volume by setting `DB_PATH` to `/data/app.db` in `railway.ts`'s `env`. SQLite also means one replica.
