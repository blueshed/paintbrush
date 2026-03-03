/**
 * Logger — colored, timestamped console output.
 *
 * Usage:
 *   const log = createLogger("[server]");
 *   log.info("listening on :3000");   // 12:34:56.789 INFO  [server] listening on :3000
 *   log.warn("slow query");           // yellow
 *   log.error("connection failed");   // red
 *
 *   const handler = loggedRequest("[api]", myHandler);  // wrap a route with access logging
 */

type Level = "info" | "warn" | "error";

const gray = (s: string) => `\x1b[90m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

const color: Record<Level, (s: string) => string> = {
  info: gray,
  warn: yellow,
  error: red,
};

function timestamp() {
  return new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
}

function fmt(level: Level, tag: string, msg: string) {
  return `${gray(timestamp())} ${color[level](level.toUpperCase().padEnd(5))} ${tag} ${msg}`;
}

/** Create a tagged logger instance. */
export function createLogger(tag: string) {
  return {
    info: (msg: string) => console.log(fmt("info", tag, msg)),
    warn: (msg: string) => console.warn(fmt("warn", tag, msg)),
    error: (msg: string) => console.error(fmt("error", tag, msg)),
  };
}

type Handler = (req: Request) => Response | Promise<Response>;

/** Wrap a route handler with access logging. */
export function loggedRequest(tag: string, handler: Handler): Handler {
  const log = createLogger(tag);
  return async (req: Request) => {
    const start = performance.now();
    try {
      const res = await handler(req);
      const ms = (performance.now() - start).toFixed(1);
      log.info(`${req.method} ${new URL(req.url).pathname} → ${res.status} (${ms}ms)`);
      return res;
    } catch (err: any) {
      const ms = (performance.now() - start).toFixed(1);
      log.error(`${req.method} ${new URL(req.url).pathname} threw (${ms}ms): ${err.message}`);
      throw err;
    }
  };
}
