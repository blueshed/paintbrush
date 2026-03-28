/**
 * Delta-WS — WebSocket hub with document sync.
 *
 * The hub is shared WebSocket infrastructure: upgrade, message routing,
 * publish/subscribe via Bun channels. Docs and methods are consumers.
 *
 * Usage (server):
 *   const hub = createHub();
 *   await hub.doc<Message>("message", { file: "./message.json", empty: { message: "" } });
 *   hub.method("status", () => ({ bun: Bun.version, uptime: process.uptime() }));
 *   const server = Bun.serve({ routes: { "/ws": hub.upgrade }, websocket: hub.websocket });
 *   hub.setServer(server);
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
// Server — Hub (shared WebSocket infrastructure)
// ---------------------------------------------------------------------------

type ActionHandler = (msg: any, ws: any, respond: (result: any) => void) => any | Promise<any>;
type MethodHandler = (params: any, ws: any) => any | Promise<any>;

interface DocOptions<T> {
  file: string;
  empty: T;
}

export function createHub() {
  const log = createLogger("[hub]");
  const actions = new Map<string, ActionHandler>();
  let serverRef: any;

  // --- Built-in actions ---

  // call: stateless RPC
  const methods = new Map<string, MethodHandler>();
  actions.set("call", async (msg, ws, respond) => {
    const handler = methods.get(msg.method);
    if (!handler) {
      respond({ error: { code: -1, message: `Unknown method: ${msg.method}` } });
      return;
    }
    log.debug(`call ${msg.method}`);
    respond({ result: await handler(msg.params, ws) });
  });

  // open/delta/close: document sync
  const docs = new Map<string, {
    getDoc(): any;
    applyAndBroadcast(ops: DeltaOp[]): void;
  }>();

  actions.set("open", (msg, ws, respond) => {
    const store = docs.get(msg.doc);
    if (!store) { respond({ error: { code: -1, message: `Unknown doc: ${msg.doc}` } }); return; }
    ws.subscribe(msg.doc);
    respond({ result: store.getDoc() });
    log.debug(`${msg.doc} opened`);
  });

  actions.set("delta", (msg, _ws, respond) => {
    const store = docs.get(msg.doc);
    if (!store) { respond({ error: { code: -1, message: `Unknown doc: ${msg.doc}` } }); return; }
    store.applyAndBroadcast(msg.ops);
    respond({ result: { ack: true } });
  });

  actions.set("close", (msg, ws, respond) => {
    ws.unsubscribe(msg.doc);
    respond({ result: { ack: true } });
    log.debug(`${msg.doc} closed`);
  });

  return {
    /** Publish to a Bun channel — any subscriber receives the message. */
    publish(channel: string, data: any) {
      serverRef?.publish(channel, JSON.stringify(data));
    },

    /** Register a custom action handler. */
    on(action: string, handler: ActionHandler) {
      actions.set(action, handler);
    },

    /** Register a persisted document. */
    async doc<T>(name: string, opts: DocOptions<T>) {
      const dataFile = Bun.file(opts.file);
      let doc: T = (await dataFile.exists())
        ? { ...structuredClone(opts.empty), ...((await dataFile.json()) as T) }
        : structuredClone(opts.empty);

      log.info(`loaded ${name} from ${opts.file}`);

      const hub = this;
      docs.set(name, {
        getDoc: () => doc,
        applyAndBroadcast(ops) {
          applyOps(doc, ops);
          Bun.write(dataFile, JSON.stringify(doc, null, 2));
          hub.publish(name, { doc: name, ops });
          log.debug(`${name} delta [${ops.map((o) => `${o.op} ${o.path}`).join(", ")}]`);
        },
      });
    },

    /** Register a stateless RPC method. */
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
          const handler = actions.get(action);
          if (!handler) {
            if (id) ws.send(JSON.stringify({ id, error: { code: -1, message: `Unknown action: ${action}` } }));
            return;
          }
          await handler(msg, ws, (response: any) => {
            if (id) ws.send(JSON.stringify({ id, ...response }));
          });
        } catch (err: any) {
          log.error(`error: ${err.message}`);
          if (id) ws.send(JSON.stringify({ id, error: { code: -1, message: err.message } }));
        }
      },
      close() {
        log.debug("ws close");
      },
    },

    setServer(s: any) {
      serverRef = s;
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
      log.debug(`#${id} ${msg.action} ${msg.doc ?? msg.method ?? ""}${msg.ops ? ` [${msg.ops.map((o: DeltaOp) => `${o.op} ${o.path}`).join(", ")}]` : ""}`);
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
