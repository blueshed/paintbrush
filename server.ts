import homepage from "./index.html";
import { buildRoutes, GET, Controller, serverRef, getNotifyTopics } from "./lib/decorators";
import { Note } from "./resources/notes-api";
import { Todo } from "./resources/todos-api";

@Controller
class Stats {
  @GET("/api/stats")
  async stats() {
    return Response.json({ notes: "ok" });
  }
}

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    ...buildRoutes(Note, Todo, Stats),
  },
  fetch(req, server) {
    if (new URL(req.url).pathname === "/ws") {
      if (server.upgrade(req)) return;
    }
    return Response.json({ error: "Not found" }, { status: 404 });
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

serverRef.current = server;

console.log(`Paintbrush → http://localhost:${server.port}`);
