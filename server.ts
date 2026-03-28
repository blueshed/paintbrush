/**
 * Server — Bun.serve() with delta-ws hub.
 *
 * Routes serve pages. The hub handles docs and methods over one WebSocket.
 */
import { createLogger } from "@blueshed/railroad";
import homepage from "./index.html";
import sample from "./resources/sample.html";
import graphPage from "./resources/graph/graph.html";
import { createHub } from "./lib/delta-ws";
import { getLogo, notFound } from "./resources/common-api";
import type { Message } from "./resources/message/message-api";
import type { GraphDoc } from "./resources/graph/graph-api";
import type { Status } from "./resources/status/status-api";

const log = createLogger("[server]");
const hub = createHub();

// --- Docs (persisted, synced) ---

const dataDir = process.env.DATA_PATH ?? `${import.meta.dir}/resources/message`;
await hub.doc<Message>("message", {
  file: `${dataDir}/message.json`,
  empty: { message: "Hello from Paintbrush" },
});

await hub.doc<GraphDoc>("graph", {
  file: `${import.meta.dir}/resources/graph/graph.json`,
  empty: {
    activities: [
      { id: "a1", name: "Code Review" },
      { id: "a2", name: "Testing" },
      { id: "a3", name: "Deployment" },
    ],
    roles: [
      { id: "r1", name: "Developer", activities: ["a1", "a2"] },
      { id: "r2", name: "Tester", activities: ["a2", "a3"] },
    ],
    persons: [
      { id: "p1", name: "Alice", primaryRole: "r1", roles: ["r1"] },
      { id: "p2", name: "Bob", primaryRole: "r2", roles: ["r1", "r2"] },
    ],
  },
});

// --- Methods (stateless RPC) ---

const startedAt = Date.now();
hub.method("status", (): Status => ({
  dataPath: process.env.DATA_PATH ?? `${import.meta.dir}/resources`,
  persistent: !!process.env.DATA_PATH,
  uptime: Math.floor((Date.now() - startedAt) / 1000),
  bun: Bun.version,
}));

// --- Serve ---

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    "/ws": hub.upgrade,
    "/favicon.ico": getLogo,
    "/logo.png": getLogo,
    "/sample": sample,
    "/graph": graphPage,
    "/*": notFound,
  },
  websocket: hub.websocket,
});

hub.setServer(server);
log.info(`listening on http://localhost:${server.port}`);
