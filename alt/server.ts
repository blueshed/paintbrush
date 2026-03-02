import homepage from "./index.html";
import { getMessage, putMessage } from "./resources/message-api";

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": homepage,
    "/api/message": {
      GET: getMessage,
      PUT: putMessage,
    },
    "/*": () => Response.json({ error: "Not found" }, { status: 404 }),
  },
});

console.log(`→ http://localhost:${server.port}`);
