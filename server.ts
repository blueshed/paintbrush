/**
 * Server — Bun.serve() with explicit routes, delta-doc store, and WebSocket hub.
 *
 * The message resource uses a delta-doc server store which provides its own
 * routes (/api/data, /ws) and broadcasts deltas over WebSocket.
 *
 * To add a route: import the handler and add an entry to the routes table.
 * To add a delta-doc resource: create a server store and spread its routes.
 */
import { createLogger, loggedRequest } from "@blueshed/railroad";
import homepage from "./index.html";
import sample from "./resources/sample.html";
import { createServerStore } from "./lib/delta-doc";
import { getStatus } from "./resources/status/status-api";
import { getLogo, notFound } from "./resources/common-api";

const log = createLogger("[server]");

const dataDir = process.env.DATA_PATH ?? `${import.meta.dir}/resources/message`;
const messageStore = await createServerStore({
  file: `${dataDir}/message.json`,
  channel: "message",
  empty: { message: "Hello from Paintbrush" },
});

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    ...messageStore.routes,
    "/api/status": {
      GET: loggedRequest("[api]", getStatus),
    },
    "/favicon.ico": getLogo,
    "/logo.png": getLogo,
    "/sample": sample,
    "/*": notFound,
  },
  websocket: {
    idleTimeout: 60,
    sendPings: true,
    open(ws) {
      const channels = (ws.data as any)?.channels;
      if (channels) {
        for (const ch of channels) ws.subscribe(ch);
      }
    },
    message() {},
  },
});

messageStore.setServer(server);

log.info(`listening on http://localhost:${server.port}`);
