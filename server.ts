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
  port: process.env.PORT || 3001,
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
    message(ws, raw) {
      try {
        const msg = JSON.parse(String(raw));
        const topics = getNotifyTopics();
        if (msg.action === "opendoc" && topics.has(msg.resource))  ws.subscribe(msg.resource);
        if (msg.action === "closedoc") ws.unsubscribe(msg.resource);
      } catch {}
    },
  },
});

provide("server", server);

console.log(`Paintbrush → http://localhost:${server.port}`);
