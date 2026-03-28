/**
 * Delta-WS — reactive document sync over WebSocket.
 *
 * Server: docs (persisted JSON + broadcast) and methods (stateless RPC).
 * Client: connect, open docs, call methods — all over one WebSocket.
 *
 * Usage (server):
 *   const hub = createHub();
 *   await hub.doc<Message>("message", { file: "./message.json", empty: { message: "" } });
 *   hub.method("status", () => ({ bun: Bun.version, uptime: process.uptime() }));
 *   Bun.serve({ routes: { "/ws": hub.upgrade }, websocket: hub.websocket });
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
import { reconnectingWebSocket } from "./reconnecting-ws";

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
// Server
// ---------------------------------------------------------------------------

interface DocStore {
  getDoc(): any;
  applyAndBroadcast(ops: DeltaOp[], ws: any): void;
}

interface DocOptions<T> {
  file: string;
  empty: T;
}

type MethodHandler = (params: any, ws: any) => any | Promise<any>;

export function createHub() {
  const log = createLogger("[hub]");
  const docs = new Map<string, DocStore>();
  const methods = new Map<string, MethodHandler>();

  return {
    async doc<T>(name: string, opts: DocOptions<T>) {
      const dataFile = Bun.file(opts.file);
      let doc: T = (await dataFile.exists())
        ? { ...structuredClone(opts.empty), ...((await dataFile.json()) as T) }
        : structuredClone(opts.empty);

      log.info(`loaded ${name} from ${opts.file}`);

      docs.set(name, {
        getDoc: () => doc,
        applyAndBroadcast(ops, ws) {
          applyOps(doc, ops);
          Bun.write(dataFile, JSON.stringify(doc, null, 2));
          ws.publish(name, JSON.stringify({ doc: name, ops }));
          log.debug(
            `${name} delta [${ops.map((o) => `${o.op} ${o.path}`).join(", ")}]`,
          );
        },
      });
    },

    method(name: string, handler: MethodHandler) {
      methods.set(name, handler);
      log.info(`method ${name}`);
    },

    upgrade: (req: Request, server: any) => {
      if (server.upgrade(req)) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    },

    websocket: {
      idleTimeout: 60,
      sendPings: true,
      open(ws: any) {
        log.debug("ws open");
      },
      async message(ws: any, raw: any) {
        const msg = JSON.parse(String(raw));
        const { id, action } = msg;

        try {
          if (action === "call") {
            const handler = methods.get(msg.method);
            if (!handler) {
              if (id) ws.send(JSON.stringify({ id, error: { code: -1, message: `Unknown method: ${msg.method}` } }));
              return;
            }
            log.debug(`call ${msg.method}`);
            const result = await handler(msg.params, ws);
            if (id) ws.send(JSON.stringify({ id, result }));
            return;
          }

          const docName = msg.doc;
          const store = docs.get(docName);
          if (!store) {
            if (id)
              ws.send(
                JSON.stringify({
                  id,
                  error: { code: -1, message: `Unknown doc: ${docName}` },
                }),
              );
            return;
          }

          switch (action) {
            case "open":
              ws.subscribe(docName);
              if (id)
                ws.send(JSON.stringify({ id, result: store.getDoc() }));
              log.debug(`${docName} opened`);
              break;
            case "delta":
              store.applyAndBroadcast(msg.ops, ws);
              if (id)
                ws.send(JSON.stringify({ id, result: { ack: true } }));
              break;
            case "close":
              ws.unsubscribe(docName);
              if (id)
                ws.send(JSON.stringify({ id, result: { ack: true } }));
              log.debug(`${docName} closed`);
              break;
            default:
              if (id)
                ws.send(
                  JSON.stringify({
                    id,
                    error: {
                      code: -1,
                      message: `Unknown action: ${action}`,
                    },
                  }),
                );
          }
        } catch (err: any) {
          log.error(`error: ${err.message}`);
          if (id)
            ws.send(
              JSON.stringify({ id, error: { code: -1, message: err.message } }),
            );
        }
      },
      close() {
        log.debug("ws close");
      },
    },

    setServer(_s: any) {
      /* reserved for future use */
    },
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const hubs = new Map<string, ReturnType<typeof createClientHub>>();

function createClientHub(wsPath: string) {
  const log = createLogger("[ws]");
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = reconnectingWebSocket(
    `${proto}//${location.host}${wsPath}`,
  );
  const connected = signal(false);
  const pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: any) => void }
  >();
  const openDocs = new Map<string, { data: ReturnType<typeof signal<any>> }>();
  let nextId = 1;
  let readyResolve: () => void;
  let ready = new Promise<void>((r) => {
    readyResolve = r;
  });

  ws.addEventListener("open", () => {
    connected.set(true);
    log.info("connected");
    readyResolve();
    // Re-open all tracked docs on reconnect
    for (const [name, entry] of openDocs) {
      log.debug(`re-open ${name}`);
      sendMsg({ action: "open", doc: name }).then((state) => {
        entry.data.set(state);
      });
    }
  });

  ws.addEventListener("close", () => {
    connected.set(false);
    log.info("disconnected");
    ready = new Promise<void>((r) => {
      readyResolve = r;
    });
  });

  ws.addEventListener(
    "message",
    ((ev: MessageEvent) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.error) {
          log.error(`#${msg.id} error: ${msg.error.message}`);
          reject(msg.error);
        } else {
          log.debug(`#${msg.id} ack`);
          resolve(msg.result);
        }
      } else if (msg.doc && msg.ops) {
        log.debug(`notify ${msg.doc} [${msg.ops.map((o: DeltaOp) => `${o.op} ${o.path}`).join(", ")}]`);
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
    }) as EventListener,
  );

  async function sendMsg(msg: any): Promise<any> {
    await ready;
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      log.debug(`#${id} ${msg.action} ${msg.doc}${msg.ops ? ` [${msg.ops.map((o: DeltaOp) => `${o.op} ${o.path}`).join(", ")}]` : ""}`);
      ws.send(JSON.stringify({ ...msg, id }));
    });
  }

  interface Doc<T> {
    data: ReturnType<typeof signal<T | null>>;
    send: (ops: DeltaOp[]) => Promise<any>;
  }

  return {
    connected,

    call<T>(method: string, params?: any): Promise<T> {
      return sendMsg({ action: "call", method, params });
    },

    open<T>(name: string): Doc<T> {
      const data = signal<T | null>(null);
      openDocs.set(name, { data });

      // Fetch initial state (async — data arrives when WS connects)
      sendMsg({ action: "open", doc: name }).then((state) => {
        data.set(state as T);
      });

      return {
        data,
        send(ops: DeltaOp[]) {
          // Optimistic local update
          const current = data.peek();
          if (current) {
            const updated = structuredClone(current);
            applyOps(updated, ops);
            data.set(updated);
          }
          return sendMsg({ action: "delta", doc: name, ops });
        },
      };
    },
  };
}

export function connect(wsPath: string = "/ws") {
  let hub = hubs.get(wsPath);
  if (!hub) {
    hub = createClientHub(wsPath);
    hubs.set(wsPath, hub);
  }
  return hub;
}
