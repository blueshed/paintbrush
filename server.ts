import homepage from "./index.html";
import { provide } from "./lib/shared";
import { getMessage, putMessage } from "./resources/message/message-api";
import { getStatus } from "./resources/status/status-api";
import { getLogo, notFound } from "./resources/common-api";

const topics = new Set(["message"]);

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    "/api/message": {
      GET: getMessage,
      PUT: putMessage,
    },
    "/api/status": {
      GET: getStatus,
    },
    "/favicon.ico": getLogo,
    "/logo.png": getLogo,
    "/ws": (req) => {
      if (server.upgrade(req)) return;
      return new Response("Upgrade failed", { status: 400 });
    },
    "/*": notFound,
  },
  websocket: {
    idleTimeout: 60,
    sendPings: true,
    message(ws, raw) {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.action === "opendoc" && topics.has(msg.resource))
          ws.subscribe(msg.resource);
        if (msg.action === "closedoc") ws.unsubscribe(msg.resource);
      } catch {}
    },
  },
});

provide("server", server);

console.log(`→ http://localhost:${server.port}`);
