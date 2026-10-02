<p align="center"><img src="./logo.png" alt="Logo" width="120"></p>

# Paintbrush

A starter for a [Bun](https://bun.sh) website: **routes and resources**, with [railroad](https://github.com/blueshed/railroad) for the page and [Railway](https://railway.com) for the deploy. Explicit routes, reactive JSX, and a resource you can evolve from an HTTP route to a WebSocket, a [delta](https://github.com/blueshed/delta) document, and beyond.

Requires Bun 1.4 or later.

```sh
bun create blueshed/paintbrush myapp
cd myapp
bun dev
```

Open `http://localhost:3000`. You get an editable message, a line saying whether your data survives a deploy, and tests for all of it.

## Routes and resources

- **Server routes** are `Bun.serve()` routes, all in `src/server.ts`. A route serves a resource: `GET` and `PUT /api/message` over HTTP, or over a WebSocket when it must be realtime.
- **Client routes** are railroad's hash router, all in `src/app.tsx`. A route draws a resource's view.
- **A resource** is a folder with three files:

| File | Role |
|------|------|
| `<name>-api.ts` | Server handlers: plain functions that return a `Response`, and the type both sides share |
| `<name>.ts` | The client store: signals and fetch wrappers |
| `<name>-view.tsx` | The view: a function component, reactive through signals |

Every route and handler is visible in the code. An AI, or a person, can read `server.ts` and `app.tsx` and know exactly what the app does.

## A resource evolves

It starts as HTTP routes. When it must be realtime it gets a WebSocket. When several people share it, it becomes a document in delta, kept in a JSON file, then SQLite, then Postgres, and the browser code does not change. Beyond that is eta. The client route and the view keep their names; what is under them changes. `.claude/skills/evolve/SKILL.md` has each step, with its tests.

## What's in the box

```
src/server.ts        Bun.serve(): the routes
src/main.ts          the entry point: a pid file, so a server started in the background can be stopped
src/app.tsx          railroad's routes
src/index.html       the page; Bun bundles the TypeScript and CSS it references
src/styles.css       the design, with its rules at the top
src/resources/       message/ and status/, three files each
tests/               routes with fetch, the page in a real browser (Bun.WebView), the entry point, the build
.railway/            the deploy, as code, with a volume for the data
```

`bun dev` serves with hot reload. `bun test` runs everything and fails below 100% coverage. `bun run build` bundles for production, and `.railway/railway.ts` deploys it: `railway config plan` shows what would change, and nothing is applied until you say so.

## Made to be worked on with Claude

`CLAUDE.md` says what is here, what not to use, and how to add a resource. `todo.jsonl` is the ledger of open work and `CHANGELOG.md` is where the project has been. In the Claude Code web sandbox, whose Bun is older and which has no browser, a SessionStart hook installs both; CI does the same on GitHub.

## Starting from it

`bun create` runs `create/setup.ts` after installing: your app gets its own name, a fresh ledger and changelog, railroad's skill, and a first commit. The template's logo, the script and its test are not copied across.

MIT
