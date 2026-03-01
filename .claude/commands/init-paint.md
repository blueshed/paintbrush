Initialize the Paintbrush app for development. This sets up root-level app files from either `zero/` (minimal) or `demo/` (full), creating the `resources/` folder ready for `/add-resource`.

Ask the user: **zero** (minimal starter) or **demo** (full demo app)?

## For zero

Create these root files:

### `index.html`
Copy from `zero/index.html`.

### `styles.css`
Copy from `zero/styles.css`.

### `server.ts`
```ts
import homepage from "./index.html";
import { buildRoutes } from "./lib/decorators";

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    ...buildRoutes(),
    "/*": () => Response.json({ error: "Not found" }, { status: 404 }),
  },
});

console.log(`→ http://localhost:${server.port}`);
```

### `app.ts`
```ts
import { routes } from "./lib/signals";
import { notFoundView } from "./lib/utils";
import { homeView } from "./resources/home-view";

const app = document.getElementById("app")!;

routes(app, {
  "/": () => { homeView(app); },
  "*": () => notFoundView(app),
});
```

### `resources/home-view.ts`
```ts
export function homeView(root: HTMLElement): void {
  root.innerHTML = `<h1>Paintbrush</h1><p>Ready to build.</p>`;
}
```

## For demo

### `index.html`
Copy from `demo/index.html`.

### `styles.css`
Copy from `demo/styles.css`.

### `resources/`
Copy all resource subfolders from `demo/resources/`: `notes/`, `todos/`, `checklists/`, `admin/`, and `home-view.ts`.

Note: demo resource files use `../../../lib/` imports (3 levels deep inside `demo/resources/{name}s/`). When copied to root `resources/{name}s/`, these must be rewritten to `../../lib/`.
The `home-view.ts` in demo uses `../../lib/` — when copied to root `resources/`, rewrite to `../lib/`.

### `server.ts`
```ts
import { mkdirSync } from "fs";
import { dirname } from "path";
import homepage from "./index.html";
import { buildRoutes, getNotifyTopics } from "./lib/decorators";
import { provide } from "./lib/shared";
import { createDatabase } from "./lib/sqlite-store";
import { Note } from "./resources/notes/notes-api";
import { Todo } from "./resources/todos/todos-api";
import { Checklist } from "./resources/checklists/checklists-api";
import { Admin } from "./resources/admin/admin-api";

const dbPath = process.env.DB_PATH ?? "./data/app.db";
mkdirSync(dirname(dbPath), { recursive: true });
provide("db", createDatabase(dbPath));

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    "/ws": (req) => {
      if (server.upgrade(req)) return;
      return new Response("Upgrade failed", { status: 400 });
    },
    ...buildRoutes(Note, Todo, Checklist, Admin),
    "/*": () => Response.json({ error: "Not found" }, { status: 404 }),
  },
  websocket: {
    idleTimeout: 60,
    sendPings: true,
    message(ws, raw) {
      try {
        const msg = JSON.parse(String(raw));
        const topics = getNotifyTopics();
        if (msg.action === "opendoc" && topics.has(msg.resource))
          ws.subscribe(msg.resource);
        if (msg.action === "closedoc") ws.unsubscribe(msg.resource);
      } catch {}
    },
  },
});

provide("server", server);

console.log(`Paintbrush → http://localhost:${server.port}`);
```

### `app.ts`
```ts
import { routes } from "./lib/signals";
import { reconnectingWebSocket } from "./lib/reconnecting-ws";
import { notFoundView } from "./lib/utils";
import { homeView } from "./resources/home-view";
import { noteListView, noteDetailView } from "./resources/notes/notes-views";
import { todoListView, todoDetailView } from "./resources/todos/todos-views";
import {
  checklistListView,
  checklistDetailView,
} from "./resources/checklists/checklists-views";
import { adminView } from "./resources/admin/admin-views";

const app = document.getElementById("app")!;
const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
const ws = reconnectingWebSocket(`${wsProto}//${location.host}/ws`);

routes(app, {
  "/": () => homeView(app),
  "/notes": () => noteListView(app),
  "/notes/:id": ({ id }) => noteDetailView(app, id),
  "/todos": () => todoListView(app, ws),
  "/todos/:id": ({ id }) => todoDetailView(app, id),
  "/checklists": () => checklistListView(app, ws),
  "/checklists/:id": ({ id }) => checklistDetailView(app, id),
  "/admin": () => adminView(app),
  "*": () => notFoundView(app),
});
```

## After creating

1. Run `bunx tsc --noEmit` — must be clean
2. Run `bun test` — existing tests must pass
3. Run `bun dev` — server starts, app loads
