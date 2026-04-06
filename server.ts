/**
 * Server — Bun.serve() with paintbrush-ws.
 *
 * The WebSocket is shared infrastructure. Docs and methods register with it.
 */
import { createLogger } from "@blueshed/railroad";
import homepage from "./index.html";
import sample from "./resources/sample.html";
import { createWs, registerDoc, registerMethod } from "@blueshed/railroad/delta-server";
import { getLogo, notFound } from "./resources/common-api";
import type { Message } from "./resources/message/message-api";
import type { Status } from "./resources/status/status-api";

const log = createLogger("[server]");
const ws = createWs();

// --- Docs (persisted, synced) ---

const dataDir = process.env.DATA_PATH ?? `${import.meta.dir}/resources/message`;
await registerDoc<Message>(ws, "message", {
  file: `${dataDir}/message.json`,
  empty: { message: "Hello from Paintbrush" },
});

// --- Methods (stateless RPC) ---

const startedAt = Date.now();
registerMethod(ws, "status", (): Status => ({
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
    "/ws": ws.upgrade,
    "/favicon.ico": getLogo,
    "/logo.png": getLogo,
    "/sample": sample,
    "/*": notFound,
  },
  websocket: ws.websocket,
});

ws.setServer(server);
log.info(`listening on http://localhost:${server.port}`);
