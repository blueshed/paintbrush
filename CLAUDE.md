# Paintbrush

<!-- template -->
> **This is the paintbrush template.** `bun create blueshed/paintbrush my-app` copies it, runs `bun install`, then runs `create/setup.ts` (the template's postinstall). Setup gives the app a fresh `todo.jsonl` and `CHANGELOG.md`, puts its name in place of "Paintbrush" in the files listed in `NAMED`, copies railroad's skill into `.claude/skills`, and deletes what is about the template: `create/`, `tests/setup.test.ts`, `logo.png`. A test fails if the word "paintbrush" appears in a file `NAMED` does not list. This repo's own `todo.jsonl` and `CHANGELOG.md` are about the template.
>
> `bun create` runs each `bun-create` postinstall entry as `bun run <entry>`, so the entry in `package.json` is `create/setup.ts`; writing `bun run create/setup.ts` runs `bun run bun run ...`, which does nothing and says nothing (checked on Bun 1.4.2). bun create's own git step also races the script (its `git add` can hit a file the script has just deleted and give up), so `setup()` ends by committing or amending, and a new app is always one commit with a clean tree. After changing `create/`, test the whole flow, more than once, since a race shows only some of the time: put a copy of this repo in a folder, then `BUN_CREATE_DIR=<that folder> bun create <the copy's name> <a new folder>`, and run `bun test` in the new folder.
>
> `setup()` refuses to run in a clone of this repo (its `origin` is the template's), because it deletes things. Write ledger and changelog text with the file tools, never inside a quoted shell argument.
<!-- /template -->

A Bun website of **routes and resources**. Bun is the server, the bundler and the test runner, with a WebSocket, SQLite and S3 built in; railroad draws the page and Railway deploys it. Explicit over implicit: every route and handler is visible in the code, so a person or an AI can read `src/server.ts` and `src/app.tsx` and know what the app does. The approach is settled, so build on it.

**Start small.** The app is what is listed below and nothing else. Add something only when the user asks for what it provides. Its code and its tests go in together, and test coverage stays at 100%.

`todo.jsonl` is the ledger of open work: check it first and keep it current. One JSON object per line: `n`, `status` (open / fixed / not fixed), `severity`, `area`, `file`, `summary`, `detail`, plus a dated `note` once an item is worked on. `CHANGELOG.md` records what has changed: write what lands under `## [Unreleased]` as it lands, breaking changes first.

## Routes and resources

- **Server routes** are `Bun.serve()` routes, all listed in `src/server.ts`. A route serves a resource: `GET` and `PUT /api/message` over HTTP. `/ws` is the one WebSocket: every socket subscribes to a resource's topic, and a handler tells every page of a change with `server.publish`.
- **Client routes** are railroad's hash router, all listed in `src/app.tsx`. A route draws a resource's view.
- **A resource** is a folder in `src/resources/<name>/` of three files:

| File | Role |
|---|---|
| `<name>-api.ts` | Server handlers: plain functions that return a `Response`. Its type is shared with the client, which imports it as a type only (`import type`), so none of the server code reaches the browser. |
| `<name>.ts` | The client store: signals, fetch wrappers, and the socket it listens on. |
| `<name>-view.tsx` | The view: a function component, reactive through signals. It says "Saved" only once the server has said so, and says so when a load or a save fails. |

`message` is an editable resource, kept as `message.json` in the data folder (`DATA_PATH`, else `data/`, which `.gitignore` leaves out). A save is published to the `message` topic, so every open page follows; the view keeps typing that has not been saved, and a socket that closes is opened again and the message loaded again. `status` is read-only: whether `DATA_PATH` is set (on Railway, a mounted volume), never where the folder is.

**A resource evolves.** It starts as HTTP routes, and the WebSocket tells every page of a change. When several people edit it at once, it becomes a document in delta (a JSON file, then SQLite, then Postgres, with the browser code unchanged); beyond that is eta. The client route and the view keep their names. The `evolve` skill has each step, with its tests.

## What is here

```
src/
  server.ts          Bun.serve(): the routes and the WebSocket, and startServer() so tests can start it on a random port
  main.ts            the entry point: a pid file and signals, then startServer()
  index.html         the page; Bun bundles what it references
  app.tsx            railroad's routes
  styles.css         the design, with its rules at the top
  resources/         message/ and status/, three files each, and toast.ts
tests/site.test.ts   routes, page, entry point and build; the browser-test rules are at its top
.railway/railway.ts  the deploy; its rules are at its top
```

Importing an `.html` file in server code gives a route value: Bun scans its `<script type="module">` and `<link rel="stylesheet">`, bundles and transpiles them (TSX included), and serves the result. There is no build step in development. Paths in the HTML are relative to the HTML file. Images and icons go in `src/` next to the HTML and are referenced by relative path from the HTML, never `/static/...`.

A server started in the background, as Claude starts them, cannot be stopped with Ctrl-C, so `main.ts` keeps a pid file (`.server.pid`), refuses to start over a live server, and removes the file on shutdown; `bun run stop` sends it SIGTERM. Tests read the `Listening on <url>` line, so keep it, and keep it last in `main.ts`.

## Adding a resource

1. `src/resources/<name>/<name>-api.ts`: the type, and the handlers. Validate what a client sends and answer 400 with `{ error }`. A `Bun.file(path)` that found no file keeps saying so after `Bun.write` creates it: make a new one for each read.
2. `src/server.ts`: add its routes, explicitly: `"/api/<name>": { GET: x.get, PUT: x.put }`. If pages must see its changes, subscribe sockets to its topic in `websocket.open` and publish from the handler, as `message` does.
3. `<name>.ts` and `<name>-view.tsx`, following `message`. A collection that changes length goes through `list()`, never `.map()`.
4. `src/app.tsx`: put the view in a route.
5. Tests in `tests/site.test.ts`: every route and method with `fetch`, the 400s included, and in the browser what a person sees and clicks, a failure included.

## Use Bun

Bun is the runtime, the package manager, the bundler and the test runner, and it does more than most projects use. Before you add a package, check what Bun already has: its documentation is in `node_modules/bun-types/docs/`. Among much else it has an HTTP server with routes and WebSockets (`Bun.serve`), SQLite (`bun:sqlite`), S3 (`Bun.s3`), password hashing and hashing (`Bun.password`, `Bun.CryptoHasher`), files (`Bun.file`, `Bun.write`), `.env` loading, and a real browser for tests (`Bun.WebView`). A folder of files is a route: `"/static/*": { dir: import.meta.dir + "/../public" }`, and the folder must exist.

### SQLite and S3

When a resource needs more than a JSON file: a table in SQLite, or files in an S3 bucket. Each is a resource like the others, added only when asked for. Both were run on Bun 1.4.2 (S3 against MinIO and against the stand-in below).

**SQLite** (`bun:sqlite`): the database is a file in the data folder, so `.gitignore` already leaves it out, and on Railway it is on the volume.

```ts
// src/resources/notes/notes-api.ts
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

export type Note = { id: number; text: string };

export function notesApi(dataDir: string) {
  mkdirSync(dataDir, { recursive: true }); // SQLite creates the file, not its folder
  const db = new Database(`${dataDir}/app.db`, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL)");

  return {
    list: () => Response.json(db.query<Note, []>("SELECT id, text FROM notes ORDER BY id").all()),

    add: async (req: Request) => {
      const body = await req.json().catch(() => null);
      if (typeof body?.text !== "string") {
        return Response.json({ error: "text must be a string" }, { status: 400 });
      }
      const note = db.query<Note, [string]>("INSERT INTO notes (text) VALUES (?) RETURNING id, text").get(body.text);
      return Response.json(note, { status: 201 });
    },
  };
}
// in startServer: const notes = notesApi(dataDir);
// in routes:      "/api/notes": { GET: notes.list, POST: notes.add },
```

The tests already give the server a scratch data folder, so the database is a fresh one: `POST` then `GET` answers `[{ id: 1, text: "first" }]`, and `"not json"`, `"{}"` and `{ text: 1 }` each answer 400.

**S3** (`Bun.s3`): `Bun.s3` is configured from `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` (or their `AWS_` names), read from `.env` or the environment when Bun starts, not from `process.env` later. On Railway they are a bucket's variables, named in `railway.ts` with `preserve()`. `startServer` takes the client as an option, `s3 = Bun.s3`, so tests can pass their own.

```ts
// src/resources/files/files-api.ts
import type { BunRequest, S3Client } from "bun";

export function filesApi(s3: S3Client) {
  return {
    // Answers a redirect to a presigned URL: the bytes come from the bucket, not this server
    get: async (req: BunRequest<"/api/files/:name">) => {
      const file = s3.file(req.params.name);
      if (!(await file.exists())) return Response.json({ error: "no such file" }, { status: 404 });
      return new Response(file);
    },

    put: async (req: BunRequest<"/api/files/:name">) => {
      await s3.write(req.params.name, await req.blob());
      return new Response(null, { status: 204 });
    },
  };
}
// in startServer: const files = filesApi(s3);
// in routes:      "/api/files/:name": { GET: files.get, PUT: files.put },
```

The redirect means the browser must be able to reach the bucket's endpoint. Tests need no real bucket: a stand-in of a few lines is enough of S3 for a write, `exists()` and a presigned read.

```ts
// A stand-in for an S3 bucket, in tests/site.test.ts (with import { S3Client } from "bun")
const objects = new Map<string, Blob>();
const bucket = Bun.serve({
  port: 0,
  async fetch(req) {
    const key = new URL(req.url).pathname;
    if (req.method === "PUT") {
      objects.set(key, await req.blob());
      return new Response();
    }
    const object = objects.get(key);
    if (!object) return new Response(null, { status: 404 });
    return new Response(req.method === "HEAD" ? null : object, { headers: { "content-length": String(object.size) } });
  },
});
const s3 = new S3Client({ endpoint: bucket.url.href, bucket: "files", accessKeyId: "test", secretAccessKey: "test" });
// start the test server with startServer({ ..., s3 }), and stop the bucket in afterAll

test("a file is put in the bucket, and a GET redirects to it", async () => {
  expect((await api("/api/files/hello.txt", { method: "PUT", body: "hello, bucket" })).status).toBe(204);
  const res = await api("/api/files/hello.txt", { redirect: "manual" });
  expect(res.status).toBe(302);
  expect(await (await fetch(res.headers.get("location")!)).text()).toBe("hello, bucket");
});
```

A file that is not there answers 404 with `{ error }`: test that too.

### The page

The page is railroad: signals and real-DOM JSX, **not React**. Read the `railroad` skill before writing JSX. The habits that matter: lowercase events (`onclick`) and `class`, never `.get()` in JSX children, and `list()` for any array that changes length.

## Tests

`bun test` prints a coverage table and fails if any line or function of the code it loads is uncovered. Never lower the threshold to get a change through; write the missing test. The client (`app.tsx`, stores, views) runs in the browser, and `main.ts` in a child process, so neither is in the table: the browser and spawn tests are what cover them. `bun run typecheck` checks the app, the tests and `railway.ts`.

## Deploying

Railway is in the box: `bun run build` (it needs `--production`, or the built server runs with hot reload on), `serve:dist`, `/health`, and `.railway/railway.ts` with a volume for the data. `package.json` names the Bun version in `packageManager`, which Railway's builder reads. **Always run `railway config plan` and show the user the result. Never run `railway config apply` without the user's explicit go-ahead, and never pass `--yes` or `--confirm-destructive`.** The rest of the rules are at the top of `railway.ts`.

## Claude Code on the web

The web sandbox's Bun is older than this app needs (`Bun.WebView` wants 1.4), it has no browser, and the hosts browsers are downloaded from are blocked. `.claude/hooks/session-start.sh` (registered in `.claude/settings.json`) installs the latest Bun from npm and a headless Chromium from an npm package, and sets `BUN_CHROME_PATH`. It does nothing anywhere else. If browser tests fail in the sandbox, the hook's header says how to run it by hand. CI (`.github/workflows/ci.yml`) does the same job for GitHub: Bun from `packageManager`, Chrome with `--no-sandbox`, then typecheck and `bun test`.
