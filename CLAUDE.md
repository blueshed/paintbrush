# Paintbrush

<!-- template -->
> **This is the paintbrush template.** `bun create blueshed/paintbrush my-app` copies it, runs `bun install`, and then runs `create/setup.ts` (the template's postinstall): a fresh `todo.jsonl` and `CHANGELOG.md`, the app's name in place of "Paintbrush", and railroad's skills copied into `.claude/skills`. So the word "Paintbrush" belongs only in the files `setup.ts` names (`NAMED`), and anything an app must keep stays out of `create/` and `tests/setup.test.ts`, which setup deletes. This repo's own `todo.jsonl` and `CHANGELOG.md` are about the template.
>
> `bun create` runs each `bun-create` postinstall entry as `bun run <entry>`. So the entry in `package.json` is `create/setup.ts`; writing `bun run create/setup.ts` runs `bun run bun run ...`, which does nothing and says nothing (checked on Bun 1.4.2, with a local template). Its first commit also races the script, so what the script writes last (`.claude/skills/`) can show as untracked in a new app. Test the whole flow after changing `create/`: `BUN_CREATE_DIR=<a folder holding a copy of this repo> bun create <that copy's name> <new folder>`, then `bun test` in the new folder.
>
> **Never run `create/setup.ts` in this repo's own folder, and never type its name inside a backtick or `$( )` in a shell command:** it is a script that deletes `create/`, `todo.jsonl` and `CHANGELOG.md` and renames the app, and it runs on whatever folder it is started in. Write ledger and changelog text with the file tools, not into a quoted shell argument.
<!-- /template -->

A Bun website with **railroad** for the page and **Railway** for the deploy. It starts as routes and resources over plain JSON, and grows by the parts under [Add when needed](#add-when-needed): static files, live documents (delta), SQLite, passwords. Bun and TypeScript throughout. Do not research alternatives: the approach below is settled. Use Bun's built-ins throughout.

**Start small.** This app is the [core](#core) and nothing else. Add a part from [Add when needed](#add-when-needed) only when the user asks for what it provides, or when another part you are adding needs it. A part's code and its tests go in together; test coverage stays at 100%.

`todo.jsonl` is the ledger of open work: check it first and keep it current. One JSON object per line: `n`, `status` (open / fixed / not fixed), `severity`, `area`, `file`, `summary`, `detail`, plus a dated `note` once an item is worked on. An item for a bug that forced a workaround says what the workaround costs. `CHANGELOG.md` records what has changed: write what lands under `## [Unreleased]` as it lands, breaking changes first.

## Do not use
- Node, npm, npx, pnpm, yarn → use `bun`, `bun install`, `bunx`
- Vite, webpack, esbuild, Parcel → Bun bundles HTML imports itself
- Express, Hono, Fastify, serve-static → use `Bun.serve()` with `routes` (including `{ dir }` for static folders)
- `ws` package → use Bun's built-in WebSocket support
- Puppeteer, Playwright, jsdom, happy-dom → use `Bun.WebView` for browser tests
- bcrypt, argon2, crypto-js → use `Bun.password` and `Bun.CryptoHasher`
- better-sqlite3, sqlite3 → use the built-in `bun:sqlite`
- concurrently, npm-run-all → use `bun run --parallel`
- `railway.json` / `railway.toml` (deprecated Config as Code) → use `.railway/railway.ts`
- `node:fs` read/write where `Bun.file()` / `Bun.write()` will do
- `dotenv` → Bun loads `.env` automatically
- React, Preact, Vue or any other framework → railroad. **This is not React**: read the skills in `.claude/skills/` (`railroad`, `bun-route`) before writing JSX. The habits that matter most: lowercase events (`onclick`) and `class`, never `.get()` in JSX children, and `list()` for any array that changes length.
- `bun init` → it adds files the core doesn't use

Bun's API docs are in `node_modules/bun-types/docs/`. Check there before guessing at an API.

## Core
```
src/
  server.ts            # startServer(): the page, one route per resource, /health
  main.ts              # entry point: pid file, signals, calls startServer()
  index.html           # the page; references ./app.tsx and ./styles.css
  app.tsx              # client entry: the hash routes
  styles.css           # the design system (see .claude/DESIGN.md)
  logo.png
  resources/
    toast.ts           # a notification, called from any view
    message/           # an editable resource: one JSON file in the data folder
      message-api.ts   #   the type both sides share, and messageApi(dataDir): get, put
      message.ts       #   client store: a signal and fetch wrappers
      message-view.tsx #   the view
    status/            # a read-only resource: what the server knows about itself
tests/
  site.test.ts         # API, browser, entry-point and production-build tests
.railway/railway.ts    # the Railway deploy
package.json
bunfig.toml            # fails `bun test` below 100% coverage
tsconfig.json          # strict, DOM, railroad's JSX, and railway.ts
.gitignore
```
Importing an `.html` file in server code gives a route value. Bun scans the HTML's `<script type="module">` and `<link rel="stylesheet">` tags, bundles and transpiles them (TypeScript and TSX included), and serves the result. No build step during development. Paths in the HTML are relative to the HTML file. More pages = more `.html` files, each imported and given a route.

The server lives in a function so tests can start it on a random port, with a scratch data folder. `main.ts` is the only file that starts it for real.

### Routes and resources
A **resource** is a folder under `src/resources/` with three files:

| File | Role |
|---|---|
| `<name>-api.ts` | The type both sides share, and `<name>Api(dataDir)`: plain handler functions that return a `Response`. The client imports this file **as a type only** (`import type`), so none of it reaches the browser. |
| `<name>.ts` | The client store: a railroad signal for what the server last said, and `fetch` wrappers that throw when the server doesn't say 2xx. |
| `<name>-view.tsx` | The view: a function component that returns real DOM and says "Saved" only once the server has. |

A **route** is two entries: the server's, in `startServer`'s `routes` (`"/api/message": { GET, PUT }`), and the page's, in `app.tsx` (`"/": () => <MessageView />`; the page's routes are railroad's hash router). Exact paths win over `:params`, which win over wildcards. For client-side routes that need a real path, add `"/*": homepage` as a catch-all.

`message` is a singleton you can edit; its data is `message.json` in the data folder (`DATA_PATH`, else `data/` in the project root, which `.gitignore` leaves out). `status` is read-only and says whether `DATA_PATH` is set (on Railway that means a mounted volume), but never where the folder is.

### Adding a resource
1. `src/resources/<name>/<name>-api.ts`: the type, and `<name>Api(dataDir)` returning the handlers. Validate what a client sends and answer 400 with `{ error }`. A `Bun.file(path)` that found no file keeps saying so after `Bun.write` creates it: make a new one for each read.
2. Wire it in `startServer`: `"/api/<name>": { GET: x.get, PUT: x.put }`, and `const x = <name>Api(dataDir)`.
3. `<name>.ts` and `<name>-view.tsx`, following `message`. A collection that changes length goes through `list()`, never `.map()`.
4. A route in `app.tsx`, or the view inside an existing route.
5. Tests, in `tests/site.test.ts`: one for each route and method with `fetch` (including the 400s), and one in the browser for what a person sees and clicks, including a refusal.

### src/main.ts
The pid file and `bun run stop` are part of the core because a server started in the background, as Claude starts them, can't be stopped with Ctrl-C. Without them the next `bun dev` fails with `EADDRINUSE`. `main.ts` writes `.server.pid`, refuses to start if a live server owns it, writes its own pid once listening, and removes it on shutdown. `bun run stop` sends it SIGTERM (cross-platform: it uses `process.kill`; on Windows the handlers don't run and the stale file is harmless, since `main.ts` checks the pid is alive). Tests set `PID_FILE` so they never touch a real server's file.

Tests read the `Listening on <url>` line, so keep it, and keep it last: a test (or `bun run stop`) may signal the server the moment it appears, and a signal that arrives before the handlers are registered kills the process without removing the pid file.

### bunfig.toml
`bun test` prints a coverage table and fails if any line or function of the code it loads is uncovered. Never lower the threshold to get a change through; write the missing test. `main.ts` runs in a child process and the client (`app.tsx`, the views, the stores) runs in the browser, so none appears in the table; the spawn and WebView tests are what cover them.

## Production and Railway
The deploy is in the box: `bun run build` bundles the server and pre-bundles the HTML imports, so production does no runtime bundling. A test builds it, runs it, and checks the page has no HMR client.

- Scripts: `start` (`NODE_ENV=production bun src/main.ts`), `build`, `serve:dist`.
- `build` needs `--production`, not just `--minify`: it inlines `NODE_ENV=production`. Without it the bundler folds `NODE_ENV !== "production"` to `true` and the built server runs with HMR on.
- `serve:dist` runs from inside `dist/` because the built server finds its bundled JS and CSS relative to the working directory. Anything else on disk (`data/`, `public/`, `.server.pid`) is located from `import.meta.dir`, never the working directory: `src/` and `dist/` both sit one level below the project root.
- `/health` answers `ok` for Railway's healthcheck.
- `package.json` has `"packageManager": "bun@1.4.2"`: Railway's builder reads the Bun version from it, and the deployed Bun must be 1.4 or later (`Bun.serve` `{ dir }` routes depend on it).

Deployment is defined in `.railway/railway.ts` using Railway's Infrastructure as Code SDK (the `railway` devDependency, used only by the Railway CLI, 5.42.1 or newer: the IaC engine ships in the CLI). `tsconfig.json` names the file in `include`, so `bun run typecheck` checks it; naming the folder is not enough, and the default skips dot-folders. Set `OWNER/REPO` in it before the first plan.

```ts
import { defineRailway, github, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    source: github("OWNER/REPO", { branch: "main" }),
    build: "bun install && bun run build",
    start: "bun run serve:dist",
    healthcheck: "/health",
    env: {
      NODE_ENV: "production",
      DATA_PATH: "/data",
    },
    volumeMounts: { "/data": volume("data") }, // the key is the mount path; keeps the data across deploys
    // domains: ["www.example.com"], // custom domains, once DNS is set up
  });

  return project("paintbrush", { resources: [web] });
});
```

Rules:
- Railway sets `PORT`; `startServer()` already reads it. Don't hard-code a port for production.
- The file describes the **whole** environment: a resource left out of it is deleted on apply. Add things (a `postgres("db")`, another `volume(...)`) rather than rewriting the file.
- Keep one replica. Websocket connections, in-memory state and the JSON file or SQLite database live in a single process; more replicas need shared state first.
- Secrets never go in this file. Set them in the Railway dashboard and reference them with `preserve()` (imported from `railway/iac`): `env: { API_KEY: preserve() }`.

Workflow, from the project root:
```bash
railway login          # once
railway link           # once: choose project and environment
railway config plan    # show what would change
railway config apply   # apply, after confirmation
```
Always run `railway config plan` and show the user the result. **Never run `railway config apply` without the user's explicit go-ahead**, and never pass `--yes` or `--confirm-destructive` (the second is what lets an agent session delete resources). An apply is rejected if the environment changed since the plan, so plan again rather than forcing it.

## Tests
Every route and everything a user sees or clicks has a test. API behaviour is tested with `fetch`; the page is tested in a real browser with `Bun.WebView`; entry points are tested by spawning them. `bun test --changed` runs only the tests affected by uncommitted changes (it needs a git repository). `tests/site.test.ts` holds the helpers (`open`, `waitFor`, `spawnServer`); add tests there. Tests run in file order, and the first one needs a data folder nothing has been saved to.

### Bun.WebView rules (the API is experimental; follow these exactly)
- `evaluate()` takes a **string expression**, not a function: `view.evaluate("document.title")`. For statements, wrap in an IIFE string: `"(() => { ... })()"`. Results come back via JSON, so return plain data, not DOM nodes. It returns `unknown` unless given a type: `evaluate<string>(...)`.
- `await` every call. Each view allows only one `navigate`, one `evaluate`, one `screenshot` and one input action in flight at a time; a second concurrent call throws `ERR_INVALID_STATE` rather than queueing.
- `navigate(url)` resolves on the page's `load` event. Anything rendered after an async `fetch` has to be polled for (use `waitFor`). Navigating to the URL the view is already at does not reload the page: `open()` gives each visit a query of its own, which the routes ignore.
- Click by selector: `view.click("button.primary")` waits until the element is visible, stable and not covered. Prefer this to coordinates.
- `click` does not scroll. An element below the window never becomes visible, so the click waits out its timeout. Scroll it into view first: `` await view.evaluate(`document.querySelector("#send").scrollIntoView({ block: "center" })`) ``, then `await view.click("#send")`.
- To fill an input: `await view.click("textarea")` to focus it, then `await view.type("text")`. Typing appends: to replace what is there, clear the box first and dispatch an `input` event (see the save test). Use `view.press("Enter")` for keys.
- `view.url` updates after each navigation. `view.title` does not: on macOS WebKit it is empty after every `navigate` but the first. Read the title with `await view.evaluate<string>("document.title")`.
- `view.screenshot()` returns a Blob: `await Bun.write("tests/out/home.png", await view.screenshot())` is useful when a test fails. `tests/out/` is in `.gitignore`.
- To test a failure, make the page's `fetch` fail: `view.evaluate("window.fetch = async () => new Response(null, { status: 500 })")`, then click.
- Backend: on macOS it uses the system WebKit, with nothing to install. On Linux and Windows it needs Chrome, Chromium, Edge or Brave installed; set `BUN_CHROME_PATH` if Bun can't find it.

Open one `WebView` per test file in `beforeAll` and close it in `afterAll`; don't create one per test (a test that needs a second window, as live documents do, opens its own and closes it in a `finally`).

## Add when needed
Each part says when it's wanted, what it changes, and the tests that come with it. Add tests to `tests/site.test.ts` and `.gitignore` lines to `.gitignore`.

### Stylesheet, images and icons
When: the page needs more than `styles.css`: images, a favicon, a second stylesheet.

- Put them in `src/` next to the HTML and reference them with relative paths: `<link rel="stylesheet" href="./more.css" />`, `<link rel="icon" href="./favicon.svg" />`, `<img src="./logo.png" />` (in `index.html`, not in a view). Bun bundles the CSS and copies and hashes the rest, in development and in the build.
- Don't use `/static/...` paths in the HTML for these. The bundler tries to resolve every `<link>`, `<img>`, `<video>` and `<audio>` path at bundle time, and an absolute path it can't find breaks the page.
- `styles.css` and `.claude/DESIGN.md` are the design system: colours are variables in `:root`, touch targets scale up under `@media (pointer: coarse)`, and the sidebar and dock switch by `pointer`, not width. Read `.claude/DESIGN.md` before adding a view.
- Tests: none of their own. If a behaviour depends on them (something hidden or shown by CSS), test that behaviour in the browser.

### Static files
When: the site serves files the page links to or fetches but doesn't embed: downloads, data files loaded at runtime. Files the HTML embeds belong in [Stylesheet, images and icons](#stylesheet-images-and-icons) instead.

- A `public/` folder, served under `/static/`. The folder must exist: the server throws on startup if it's missing.
- Route in `server.ts`. The path is resolved from `import.meta.dir`, not the working directory, so it also works from the production build:
```ts
// Static folder (ETag, Range, 304 handled by Bun)
"/static/*": { dir: `${import.meta.dir}/../public` },
```
- Reference files as `/static/<name>` from links and code, e.g. `<a href="/static/guide.pdf">` or `fetch("/static/data.json")`.
- Test, one per file the site relies on:
```ts
test("guide.pdf is served from public/", async () => {
  const res = await api("/static/guide.pdf");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("application/pdf");
});
```

A single file at a route of your own (a download whose URL or access isn't its filename) is a `Response` around `Bun.file()`. Bun streams it from disk and sets `content-type` from the extension. Resolve the path from `import.meta.dir`, and test it the same way:
```ts
"/download/report": () => new Response(Bun.file(`${import.meta.dir}/../data/report.pdf`)),
```

### WebSocket
When: the page needs live updates from the server and they are not documents. (If what changes is a document that several people read and write, use [Live documents](#live-documents-delta) instead.)

- Route and handlers in `server.ts`:
```ts
// in routes:
"/ws": (req, server) => {
  if (server.upgrade(req)) return;
  return new Response("Upgrade required", { status: 426 });
},

// next to routes and fetch:
websocket: {
  open(ws) { ws.send("connected"); },
  message(ws, msg) { ws.send(`echo: ${msg}`); },
  close(ws) {},
},
```
- Client, in a store:
```ts
const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
ws.onmessage = (e) => console.log(e.data);
```
- Test:
```ts
test("websocket connects and echoes", async () => {
  expect((await api("/ws")).status).toBe(426); // plain HTTP

  const ws = new WebSocket(new URL("/ws", server.url.href.replace("http", "ws")));
  const messages: string[] = [];
  await new Promise<void>((done) => {
    ws.onmessage = (e) => {
      messages.push(String(e.data));
      if (messages.length === 1) ws.send("hi");
      else done();
    };
  });
  ws.close();
  expect(messages).toEqual(["connected", "echo: hi"]);
});
```

### Live documents (delta)
When: several people read and write the same data and each should see the others' changes as they happen. [@blueshed/delta](https://github.com/blueshed/delta) keeps the document, applies a write as JSON-Patch ops, and tells every open window. It rides one WebSocket, and its browser side is a railroad signal, so a view needs no glue. This replaces a resource's GET/PUT pair; the steps below turn `message` into a document. delta starts on the smallest backend, a JSON file, and graduates to SQLite or Postgres without the browser code changing; the delta-doc skill says how.

- `bun add @blueshed/delta`, then `bunx @blueshed/delta install-skills` (it installs delta's skill, and refreshes railroad's). Read the `delta-doc` skill before going further: it has the rules (one op vocabulary, never update locally after a send: the op echoes back and renders itself).
- `message-api.ts` keeps only the type: `export type Message = { message: string };`. The handlers go.
- `server.ts`: `startServer` becomes `async` (registering a document is async), and `main.ts` and the tests `await` it:
```ts
import { createWs, registerDoc } from "@blueshed/delta/server";
import type { Message } from "./resources/message/message-api";

// in startServer, before Bun.serve:
const ws = createWs();
await registerDoc<Message>(ws, "message", {
  file: `${dataDir}/message.json`,
  empty: { message: "Hello from Paintbrush" },
});

// in routes, replacing "/api/message":
[ws.path]: ws.upgrade, // the one WebSocket: every document rides it

// next to routes and fetch:
websocket: ws.websocket,

// after Bun.serve:
ws.setServer(server);
return server;
```
- `message.ts`: the store is the document.
```ts
import { connectWs, openDoc } from "@blueshed/delta/client";
import type { Message } from "./message-api";

/** The "message" document: `message.data` is a railroad signal, null until it arrives. */
export const message = openDoc<Message>("message", connectWs("/ws"));

/** Resolves once the server has applied the write and echoed it back. */
export const save = (text: string) => message.send([{ op: "replace", path: "/message", value: text }]);
```
- `message-view.tsx`: follow the document, unless the box holds typing that has not been saved:
```tsx
const text = signal(message.data.peek()?.message ?? "");
let shown = text.peek(); // what the box last took from the document

effect(() => {
  const doc = message.data.get();
  if (doc && text.peek() === shown) {
    shown = doc.message;
    text.set(doc.message);
  }
});
```
  The rest (`onsave`, the textarea, the button) is as it was, with `save` from `./message`; the load-failure message goes, since there is no load to fail.
- Tests: the GET and PUT tests go, and the browser tests change. The test server starts with `await startServer(...)`. Add one that a second window sees a save, and one that typing in the box is not overwritten by a change from another window:
```ts
test("saving says Saved, and another window sees it", async () => {
  const other = new Bun.WebView({ width: 1280, height: 800, console: globalThis.console });
  try {
    await open();
    await other.navigate(`${server.url.href}?other`);
    await waitFor(`document.querySelector("textarea")?.value === "Hello from Paintbrush"`);
    // clear the box the way typing would, then type and save
    await view.evaluate(`(() => { const t = document.querySelector("textarea"); t.value = ""; t.dispatchEvent(new Event("input")); })()`);
    await view.click("textarea");
    await view.type("typed in the browser");
    await view.click("button.primary");
    await waitFor(`document.querySelector(".toast.show.notify")?.textContent === "Saved"`);
    // poll the other window
    for (let i = 0; i < 100; i++) {
      if (await other.evaluate<boolean>(`document.querySelector("textarea")?.value === "typed in the browser"`)) break;
      await Bun.sleep(50);
    }
    expect(await other.evaluate<string>(`document.querySelector("textarea").value`)).toBe("typed in the browser");
  } finally {
    other.close();
  }
});
```
- On Railway the document file is on the volume already (`DATA_PATH`). One replica still holds, until the backend is Postgres.
- A refused write rejects `save`, and the view says "Not saved". Test your own refusals; the part above has none.

### SQLite
When: the site stores records that must survive a restart and the JSON file no longer fits. Use the built-in `bun:sqlite`; never install a SQLite package. (If the data is a live document, graduate delta's backend instead: see the delta-doc skill.)

- `.gitignore`: `*.db`, `*.db-wal`, `*.db-shm`
- `src/db.ts`. The path comes from `DB_PATH`, else the project root (from `import.meta.dir`, never the working directory, so it's the same under `bun run dev` and `serve:dist`):
```ts
import { Database } from "bun:sqlite";

export function createDatabase(path = process.env.DB_PATH ?? `${import.meta.dir}/../data.db`) {
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run(
    "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL)",
  );
  return db;
}
```
- `server.ts` takes the database as an argument, so tests can pass `:memory:`. Add `import { createDatabase } from "./db";` and a `db = createDatabase()` option to `startServer`, then use it in a resource's handlers (`itemsApi(db)`).
- Tests: start the test server with `startServer({ port: 0, dev: false, dataDir, db: createDatabase(":memory:") })`. In `spawnServer`'s `env`, add `DB_PATH: ":memory:"` so spawned servers never create a real `data.db`.
- On Railway the container's disk is wiped on every deploy: set `DB_PATH` to a file on the volume (`/data/app.db`) in `railway.ts`'s `env`. SQLite also means one replica.

### Passwords
When: users sign in. Use the built-in `Bun.password`; never install `bcrypt` or `argon2`.
```ts
const hash = await Bun.password.hash(plain);           // argon2id by default; store only the hash
const ok = await Bun.password.verify(plain, hash);     // true or false
```
Tests: none of their own. Test the handlers that call it: the stored value is not the plain text, the right password is accepted, a wrong one is rejected.
