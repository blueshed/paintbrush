import homepage from "./index.html";
import { messageApi } from "./resources/message/message-api";
import { statusApi } from "./resources/status/status-api";

export function startServer({
  port = Number(process.env.PORT ?? 3000),
  dev = process.env.NODE_ENV !== "production",
  dataDir = process.env.DATA_PATH ?? `${import.meta.dir}/../data`,
} = {}) {
  const message = messageApi(dataDir);
  const status = statusApi();

  return Bun.serve({
    port,

    development: dev && {
      hmr: true,      // hot reload in the browser
      console: true,  // echo browser console.log to the terminal
    },

    routes: {
      "/": homepage,

      // One route per resource (see src/resources/)
      "/api/message": { GET: message.get, PUT: message.put },
      "/api/status": { GET: status.get },

      // One WebSocket: the server pushes on it, the page listens (see websocket below)
      "/ws": (req, server) =>
        server.upgrade(req) ? undefined : new Response("Upgrade required", { status: 426 }),

      // Railway healthcheck
      "/health": new Response("ok"),
    },

    // Every socket subscribes to each resource's topic; a handler publishes with server.publish
    websocket: {
      open(ws) {
        ws.subscribe("message");
      },
      message() {}, // the page only listens
    },

    // Anything not matched by a route
    fetch() {
      return new Response("Not found", { status: 404 });
    },
  });
}
