import homepage from "./index.html";
import { join } from "path";
import { provide } from "./lib/shared";
import {
  getMessage,
  putMessage,
  getStatus,
} from "./resources/message/message-api";

const topics = new Set(["message"]);
const serveLogo = () => {
  const file = Bun.file(join(import.meta.dir, "logo.png"));
  return new Response(file, { headers: { "Content-Type": file.type } });
};

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
    "/favicon.ico": serveLogo,
    "/logo.png": serveLogo,
    "/ws": (req) => {
      if (server.upgrade(req)) return;
      return new Response("Upgrade failed", { status: 400 });
    },
    "/*": () => Response.json({ error: "Not found" }, { status: 404 }),
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
