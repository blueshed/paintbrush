/**
 * Delta-doc — document sync over paintbrush-ws.
 *
 * Server: register docs and methods with a paintbrush-ws server.
 * Client: open docs and call methods via a paintbrush-ws client.
 *
 * Usage (server):
 *   import { createServer } from "./paintbrush-ws";
 *   const ws = createServer();
 *   await registerDoc<Message>(ws, "message", { file: "./message.json", empty: { message: "" } });
 *   registerMethod(ws, "status", () => ({ bun: Bun.version }));
 *   const server = Bun.serve({ routes: { "/ws": ws.upgrade }, websocket: ws.websocket });
 *   ws.setServer(server);
 *
 * Usage (client):
 *   const hub = connect("/ws");
 *   const message = hub.open<Message>("message");
 *   effect(() => console.log(message.data.get()));           // reactive reads
 *   message.send([{ op: "replace", path: "/message", value: "hello" }]); // writes
 *   const status = await hub.call<Status>("status");          // stateless RPC
 *
 * Delta ops (JSON Pointer paths, `/`-separated, numeric for array index, `-` for append):
 *   { op: "replace", path: "/field",    value: "new" }  — set a value at path
 *   { op: "add",     path: "/items/-",  value: item }   — append to array
 *   { op: "remove",  path: "/items/0" }                  — delete by index
 *
 * Multiple ops in one send() are atomic — applied, persisted, and broadcast together.
 */
import { createLogger, signal } from "@blueshed/railroad";
import { inject } from "@blueshed/railroad/shared";
import { type ActionHandler, type WsClient, WS } from "./paintbrush-ws";

// ---------------------------------------------------------------------------
// Types (shared)
// ---------------------------------------------------------------------------

export type DeltaOp =
  | { op: "replace"; path: string; value: unknown }
  | { op: "add"; path: string; value: unknown }
  | { op: "remove"; path: string };

// ---------------------------------------------------------------------------
// Delta apply (shared)
// ---------------------------------------------------------------------------

function parsePath(path: string): (string | number)[] {
  return path
    .split("/")
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

function walk(
  obj: any,
  segments: (string | number)[],
): { parent: any; key: string | number } {
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    current = current[segments[i]!];
    if (current == null)
      throw new Error(`Path not found at segment ${segments[i]}`);
  }
  return { parent: current, key: segments[segments.length - 1]! };
}

export function applyOps(doc: any, ops: DeltaOp[]): void {
  for (const op of ops) {
    const segments = parsePath(op.path);
    const { parent, key } = walk(doc, segments);
    switch (op.op) {
      case "replace":
      case "add":
        if (Array.isArray(parent) && key === "-") parent.push(op.value);
        else parent[key] = op.value;
        break;
      case "remove":
        if (Array.isArray(parent) && typeof key === "number")
          parent.splice(key, 1);
        else delete parent[key];
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Server — register docs and methods with a paintbrush-ws server
// ---------------------------------------------------------------------------

interface DocOptions<T> {
  file: string;
  empty: T;
}

/** Register a persisted document with the WebSocket server. */
export async function registerDoc<T>(
  ws: { on: (action: string, handler: ActionHandler) => void; publish: (channel: string, data: any) => void },
  name: string,
  opts: DocOptions<T>,
) {
  const log = createLogger(`[${name}]`);
  const dataFile = Bun.file(opts.file);
  let doc: T = (await dataFile.exists())
    ? { ...structuredClone(opts.empty), ...((await dataFile.json()) as T) }
    : structuredClone(opts.empty);

  log.info(`loaded from ${opts.file}`);

  ws.on("open", (msg, client, respond) => {
    if (msg.doc !== name) return;
    client.subscribe(name);
    respond({ result: doc });
    log.debug("opened");
  });

  ws.on("delta", (msg, _client, respond) => {
    if (msg.doc !== name) return;
    applyOps(doc, msg.ops);
    Bun.write(dataFile, JSON.stringify(doc, null, 2));
    ws.publish(name, { doc: name, ops: msg.ops });
    respond({ result: { ack: true } });
    log.debug(`delta [${msg.ops.map((o: DeltaOp) => `${o.op} ${o.path}`).join(", ")}]`);
  });

  ws.on("close", (msg, client, respond) => {
    if (msg.doc !== name) return;
    client.unsubscribe(name);
    respond({ result: { ack: true } });
    log.debug("closed");
  });
}

/** Register a stateless RPC method with the WebSocket server. */
export function registerMethod(
  ws: { on: (action: string, handler: ActionHandler) => void },
  name: string,
  handler: (params: any, client: any) => any | Promise<any>,
) {
  ws.on("call", async (msg, client, respond) => {
    if (msg.method !== name) return;
    const log = createLogger(`[${name}]`);
    log.debug("called");
    respond({ result: await handler(msg.params, client) });
  });
}

// ---------------------------------------------------------------------------
// Client — open docs and call methods via the provided WS
// ---------------------------------------------------------------------------

export interface Doc<T> {
  data: ReturnType<typeof signal<T | null>>;
  send: (ops: DeltaOp[]) => Promise<any>;
}

const openDocs = new Map<string, { data: ReturnType<typeof signal<any>> }>();
let wsSetup = false;

function ensureWsListeners(ws: WsClient) {
  if (wsSetup) return;
  wsSetup = true;

  ws.on("open", () => {
    for (const [name, entry] of openDocs) {
      ws.send({ action: "open", doc: name }).then((state) => {
        entry.data.set(state);
      });
    }
  });

  ws.on("message", (msg) => {
    if (msg.doc && msg.ops) {
      const entry = openDocs.get(msg.doc);
      if (entry) {
        const current = entry.data.peek();
        if (current) {
          const updated = structuredClone(current);
          applyOps(updated, msg.ops);
          entry.data.set(updated);
        }
      }
    }
  });
}

/** Open a persisted doc. Injects the WS connection provided by app.tsx. */
export function openDoc<T>(name: string): Doc<T> {
  const ws = inject(WS);
  ensureWsListeners(ws);

  const data = signal<T | null>(null);
  openDocs.set(name, { data });

  ws.send({ action: "open", doc: name }).then((state) => {
    data.set(state as T);
  });

  return {
    data,
    send(ops: DeltaOp[]) {
      const current = data.peek();
      if (current) {
        const updated = structuredClone(current);
        applyOps(updated, ops);
        data.set(updated);
      }
      return ws.send({ action: "delta", doc: name, ops });
    },
  };
}

/** Call a stateless method. Injects the WS connection provided by app.tsx. */
export function call<T>(method: string, params?: any): Promise<T> {
  return inject(WS).send({ action: "call", method, params });
}
