import homepage from "./index.html";
import { getMessage, putMessage, getStatus } from "./resources/message-api";

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
    "/*": () => Response.json({ error: "Not found" }, { status: 404 }),
  },
});

console.log(`→ http://localhost:${server.port}`);
