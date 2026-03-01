import homepage from "./index.html";
import { buildRoutes } from "../lib/decorators";
import { Message } from "./resources/message-api";

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    ...buildRoutes(Message),
    "/*": () => Response.json({ error: "Not found" }, { status: 404 }),
  },
});

console.log(`→ http://localhost:${server.port}`);
