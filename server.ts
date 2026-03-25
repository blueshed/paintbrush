/**
 * Server — Bun.serve() with explicit routes and WebSocket hub.
 *
 * Every route maps directly to a handler function imported from a resource.
 * The WebSocket hub subscribes clients to resource topics (opendoc/closedoc)
 * so server handlers can publish live updates via tryInject("server").
 *
 * To add a route: import the handler and add an entry to the routes table.
 * To add a WS topic: add the resource name to the `topics` set.
 */
import { createLogger, loggedRequest } from "@blueshed/railroad";
import homepage from "./index.html";
import sample from "./resources/sample.html";
import { provide, SERVER } from "./lib/shared";
import { getMessage, putMessage } from "./resources/message/message-api";
import { getStatus } from "./resources/status/status-api";
import { getLogo, notFound } from "./resources/common-api";

const log = createLogger("[server]");

const topics = new Set(["message"]);

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    "/api/message": {
      GET: loggedRequest("[api]", getMessage),
      PUT: loggedRequest("[api]", putMessage),
    },
    "/api/status": {
      GET: loggedRequest("[api]", getStatus),
    },
    "/favicon.ico": getLogo,
    "/logo.png": getLogo,
    "/ws": (req) => {
      if (server.upgrade(req)) return;
      return new Response("Upgrade failed", { status: 400 });
    },
    "/sample": sample,
    "/*": notFound,
  },
  websocket: {
    idleTimeout: 60,
    sendPings: true,
    message(ws, raw) {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.action === "opendoc" && topics.has(msg.resource)) {
          ws.subscribe(msg.resource);
          log.debug(`ws subscribe: ${msg.resource}`);
        }
        if (msg.action === "closedoc") {
          ws.unsubscribe(msg.resource);
          log.debug(`ws unsubscribe: ${msg.resource}`);
        }
      } catch {}
    },
  },
});

provide(SERVER, server);

log.info(`listening on http://localhost:${server.port}`);
