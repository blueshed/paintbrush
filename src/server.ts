import homepage from "./index.html";
import { messageRoutes } from "./resources/message/api";
import { statusRoutes } from "./resources/status/api";

export function startServer({
  port = Number(process.env.PORT ?? 3000),
  dev = process.env.NODE_ENV !== "production",
  dataDir = process.env.DATA_PATH ?? `${import.meta.dir}/../data`,
} = {}) {
  return Bun.serve({
    port,

    development: dev && {
      hmr: true,      // hot reload in the browser
      console: true,  // echo browser console.log to the terminal
    },

    routes: {
      "/": homepage,

      // A resource brings its own routes (src/resources/)
      ...messageRoutes(dataDir),
      ...statusRoutes(),

      // Railway healthcheck
      "/health": new Response("ok"),
    },

    // Anything not matched by a route
    fetch() {
      return new Response("Not found", { status: 404 });
    },
  });
}
