<p align="center"><img src="./logo.png" alt="Logo" width="120"></p>

# Paintbrush

**A Bun website that grows with its requirements.**

It starts as little as a site can be: routes and resources over plain JSON, [railroad](https://github.com/blueshed/railroad) for the page, [Railway](https://railway.com) for the deploy. When the site needs more, you add one part at a time: static files, live documents with [delta](https://github.com/blueshed/delta), SQLite, passwords. Nothing is there until it is asked for, and everything that is there is tested.

```sh
bun create blueshed/paintbrush myapp
cd myapp
bun dev
```

Open `http://localhost:3000`: a message you can edit and save, and a line that says whether your data will survive a deploy. Needs [Bun](https://bun.sh) 1.4 or later.

## How it fits together

```
 the page                                         the server
 ────────                                         ──────────
 app.tsx   a hash route
    │
 view.tsx  signals and JSX                         server.ts   routes: /  /api/message  /health
    │                                                  │
 store.ts  resource("/api/message")  ── GET, PUT ──▶  message/api.ts ──▶ data/message.json
```

A **resource** is a folder of three files, and the role is the name: `api.ts` (the type both sides share, and the routes), `store.ts` (what the page holds: a signal, `load`, `save`) and `view.tsx`. A **route** is two lines: the resource's, spread into `startServer`, and the page's, in `app.tsx`. Adding a resource is copying `message` and changing what it says.

The same server runs three ways: `bun dev` (hot reload), `bun run build` and `serve:dist` (bundled, no runtime bundling), and from a test, on a random port. `main.ts` keeps a pid file, so a server started in the background can be stopped with `bun run stop`.

## It grows

| You need | Add | What changes |
|---|---|---|
| a download, or data loaded at runtime | static files | one route, one test |
| updates pushed to the page | a WebSocket | a route and a store |
| several people editing the same thing, live | delta | a resource becomes a document; its view hardly changes |
| records that outlive a restart and no longer fit in a file | SQLite | a database behind a resource |
| sign-in | passwords | `Bun.password`, tested through its handlers |
| menus, lists, dialogs | the rest of the design system | the CSS the starter leaves out |

Each is a file in `.claude/skills/add-part/parts/`, with its code and its tests.

## Made to be worked on with Claude

`CLAUDE.md` is short on purpose: what is here, what not to use, and the rules that hold. The rest is in skills that load when they are needed (`add-part`, `webview-tests`, `railway-deploy`, and railroad's own). Every route and everything a person sees or clicks has a test, coverage is held at 100%, and a Claude Code web session gets Bun and a browser from a SessionStart hook. `todo.jsonl` is the ledger of open work and `CHANGELOG.md` is where the project has been; both are kept as the work happens.

## Deploying

`.railway/railway.ts` describes the service, its healthcheck and a volume for the data. `railway config plan` shows what would change; nothing is applied until you say so.

## Starting from it

`bun create` runs `create/setup.ts` after installing: your app gets its own name, a fresh ledger and changelog, and railroad's skills. The template's logo, the script and its test are not copied across.

MIT
