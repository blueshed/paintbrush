# Paintbrush

<!-- template -->
> **This is the paintbrush template.** `bun create blueshed/paintbrush my-app` copies it, runs `bun install`, then runs `create/setup.ts` (the template's postinstall). Setup gives the app a fresh `todo.jsonl` and `CHANGELOG.md`, puts its name in place of "Paintbrush" in the files listed in `NAMED`, copies railroad's skills into `.claude/skills`, and deletes what is about the template: `create/`, `tests/setup.test.ts`, `logo.png`. A test fails if the word "paintbrush" appears in a file `NAMED` does not list. This repo's own `todo.jsonl` and `CHANGELOG.md` are about the template.
>
> `bun create` runs each `bun-create` postinstall entry as `bun run <entry>`, so the entry in `package.json` is `create/setup.ts`; writing `bun run create/setup.ts` runs `bun run bun run ...`, which does nothing and says nothing (checked on Bun 1.4.2). Its first commit also races the script, so `.claude/skills/`, which is written last, can show as untracked in a new app. After changing `create/`, test the whole flow: put a copy of this repo in a folder, then `BUN_CREATE_DIR=<that folder> bun create <the copy's name> <a new folder>`, and run `bun test` in the new folder.
>
> `setup()` refuses to run in a clone of this repo (its `origin` is the template's), because it deletes things. Write ledger and changelog text with the file tools, never inside a quoted shell argument.
<!-- /template -->

A Bun website that grows with its requirements. It starts as routes and resources over plain JSON, with railroad for the page and Railway for the deploy, and gains parts (static files, live documents with delta, SQLite, passwords) only when they are asked for. Bun and TypeScript throughout. The approach is settled: do not research alternatives, and use Bun's built-ins.

**Start small.** The app is what is listed below and nothing else. Add a part only when the user asks for what it provides, or when another part you are adding needs it (`add-part` skill). A part's code and its tests go in together, and test coverage stays at 100%.

`todo.jsonl` is the ledger of open work: check it first and keep it current. One JSON object per line: `n`, `status` (open / fixed / not fixed), `severity`, `area`, `file`, `summary`, `detail`, plus a dated `note` once an item is worked on. `CHANGELOG.md` records what has changed: write what lands under `## [Unreleased]` as it lands, breaking changes first.

## Do not use
- Node, npm, npx, pnpm, yarn → `bun`, `bun install`, `bunx`
- Vite, webpack, esbuild, Parcel → Bun bundles HTML imports itself
- Express, Hono, Fastify, serve-static → `Bun.serve()` with `routes` (including `{ dir }` for static folders)
- the `ws` package → Bun's built-in WebSocket
- Puppeteer, Playwright, jsdom, happy-dom → `Bun.WebView` for browser tests
- bcrypt, argon2, crypto-js → `Bun.password` and `Bun.CryptoHasher`
- better-sqlite3, sqlite3 → the built-in `bun:sqlite`
- concurrently, npm-run-all → `bun run --parallel`
- `railway.json`, `railway.toml` (deprecated) → `.railway/railway.ts`
- `node:fs` reads and writes where `Bun.file()` and `Bun.write()` will do
- `dotenv` → Bun loads `.env` itself
- `bun init` → it adds files this app does not use
- React, Preact, Vue or any other framework → railroad. **This is not React.** Read the `railroad` skill before writing JSX: lowercase events (`onclick`) and `class`, never `.get()` in JSX children, `list()` for any array that changes length.

Bun's API docs are in `node_modules/bun-types/docs/`. Check there before guessing at an API.

## What is here
```
src/
  server.ts          startServer(): the page, each resource's routes, /health
  main.ts            the entry point: a pid file and signals, then startServer()
  index.html         the page; Bun bundles what it references
  app.tsx            the client: the hash routes
  styles.css         the design system as far as the app uses it (.claude/DESIGN.md)
  resources/
    json-file.ts     a value kept in one JSON file (server)
    resource.ts      a resource as the page sees it: a signal and load/save (client)
    toast.ts         a notification, called from any view
    message/         an editable resource: api.ts, store.ts, view.tsx
    status/          a read-only resource, the same three files
tests/site.test.ts   routes, page, entry point and build
.railway/railway.ts  the deploy
```
Importing an `.html` file in server code gives a route value: Bun scans its `<script type="module">` and `<link rel="stylesheet">`, bundles and transpiles them (TSX included), and serves the result. There is no build step in development. Paths in the HTML are relative to the HTML file.

A **resource** is a folder with three files, and the role is the name:

| File | Role |
|---|---|
| `api.ts` | The type both sides share, and `<name>Routes(dataDir)`: the route or routes, as plain handlers that return a `Response`. The client imports it as a type only (`import type`), so none of it reaches the browser. |
| `store.ts` | `resource<T>(url)`: a signal of the server's last answer (`data`), `load()`, `save()` and `failed`. It has the shape of a delta document's client handle. |
| `view.tsx` | The view. It says "Saved" only once the server has said so, and says so when a load or a save fails. |

A **route** is two entries: the resource's, spread into `startServer`'s `routes` (`...messageRoutes(dataDir)`), and the page's, in `app.tsx` (railroad's hash router). Exact paths win over `:params`, which win over wildcards.

`message` is a singleton you can edit, kept as `message.json` in the data folder (`DATA_PATH`, else `data/`, which `.gitignore` leaves out). `status` is read-only and says whether `DATA_PATH` is set (on Railway, a mounted volume), never where the folder is.

`startServer()` is a function so tests can start it on a random port with a scratch data folder; `main.ts` is the only file that starts it for real. A server started in the background, as Claude starts them, cannot be stopped with Ctrl-C, so `main.ts` keeps a pid file (`.server.pid`), refuses to start over a live server, and removes the file on shutdown; `bun run stop` sends it SIGTERM. Tests read the `Listening on <url>` line, so keep it, and keep it last in `main.ts`.

## Adding a resource
1. `src/resources/<name>/api.ts`: the type, and `<name>Routes(dataDir)` returning `{ "/api/<name>": { GET, PUT } }`, keeping the data with `jsonFile(...)`. Validate what a client sends and answer 400 with `{ error }`.
2. `src/server.ts`: add `...<name>Routes(dataDir)` to `routes`.
3. `store.ts`: `export const <name> = resource<Type>("/api/<name>");`
4. `view.tsx`: follow `message`. Load on mount, show `failed`, `save()` inside a `try`, and toast "Saved" or "Not saved" after the server has answered. A collection that changes length goes through `list()`.
5. `app.tsx`: put the view in a route.
6. Tests in `tests/site.test.ts`: every route and method with `fetch`, the 400s included, and in the browser what a person sees and clicks, a refusal included.

## Tests
Every route and everything a person sees or clicks has a test: routes with `fetch`, the page in a real browser with `Bun.WebView`, entry points by spawning them. `bun test` prints a coverage table and fails if any line or function of the code it loads is uncovered. Never lower the threshold to get a change through; write the missing test. The client (`app.tsx`, views, stores) runs in the browser, and `main.ts` in a child process, so neither is in the table: the browser and spawn tests are what cover them. `bun run typecheck` checks the app, the tests and `railway.ts`. Read the `webview-tests` skill before writing a browser test.

## Deploying
Railway is in the box: `bun run build`, `/health`, and `.railway/railway.ts` with a volume for the data. Read the `railway-deploy` skill before changing any of it. **Always run `railway config plan` and show the user the result. Never run `railway config apply` without the user's explicit go-ahead, and never pass `--yes` or `--confirm-destructive`.**

## Skills
`.claude/skills/` holds `railroad` and `bun-route` (railroad's, copied at creation), and `add-part`, `webview-tests` and `railway-deploy` (this app's). `bun-route` is for adding a separate HTML page; its bootstrap (`bun init`) and Playwright steps do not apply here, and where a skill and this file disagree, this file wins. Refresh railroad's with `bunx @blueshed/delta install-skills` once delta is added, or by copying `node_modules/@blueshed/railroad/.claude/skills`.

In the Claude Code web sandbox a SessionStart hook (`.claude/hooks/session-start.sh`) provides Bun and a browser; it does nothing anywhere else.
