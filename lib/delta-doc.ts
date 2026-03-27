/**
 * Generic document store — server and client factories.
 *
 * Server: JSON file + in-memory doc + delta broadcast over a WebSocket channel.
 * Client: fetch + signal + WebSocket listener + sendDelta.
 *
 * Usage (server):
 *   const store = await createServerStore({ file: "./data.json", channel: "myapp", empty: { items: [] } });
 *   // spread store.routes into Bun.serve({ routes })
 *   // after Bun.serve(), call store.setServer(server)
 *
 * Usage (client):
 *   const { data, dataVersion, sendDelta, init } = createClientStore<MyData>({ apiPath: "/api/data", wsPath: "/ws" });
 *   await init();
 */
import { createLogger, signal } from "@blueshed/railroad";
import { reconnectingWebSocket } from "./reconnecting-ws";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeltaOp =
  | { op: "replace"; path: string; value: unknown }
  | { op: "add"; path: string; value: unknown }
  | { op: "remove"; path: string };

export interface Delta {
  id: string;
  ts: number;
  ops: DeltaOp[];
}

// ---------------------------------------------------------------------------
// Shared delta apply
// ---------------------------------------------------------------------------

function parsePath(path: string): (string | number)[] {
  return path.split("/").filter(Boolean).map((s) => /^\d+$/.test(s) ? Number(s) : s);
}

function walk(obj: any, segments: (string | number)[]): { parent: any; key: string | number } {
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    current = current[segments[i]!];
    if (current == null) throw new Error(`Path not found at segment ${segments[i]}`);
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
        if (Array.isArray(parent) && typeof key === "number") parent.splice(key, 1);
        else delete parent[key];
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Server store
// ---------------------------------------------------------------------------

interface ServerStoreOptions<T> {
  file: string;
  channel: string;
  empty: T;
  prefix?: string; // URL prefix, e.g. "/accl" → routes at /accl/api/data, /accl/ws
}

export async function createServerStore<T>(opts: ServerStoreOptions<T>) {
  const log = createLogger(`[${opts.channel}]`);
  const prefix = opts.prefix ?? "";
  const dataFile = Bun.file(opts.file);
  let doc: T = (await dataFile.exists())
    ? { ...structuredClone(opts.empty), ...(await dataFile.json() as T) }
    : structuredClone(opts.empty);
  let deltaSeq = 0;
  let serverRef: ReturnType<typeof Bun.serve>;

  log.info(`loaded ${opts.file}`);

  async function persist() {
    await Bun.write(dataFile, JSON.stringify(doc, null, 2));
  }

  function applyAndBroadcast(ops: DeltaOp[]): Delta {
    applyOps(doc, ops);
    const delta: Delta = { id: `d${++deltaSeq}`, ts: Date.now(), ops };
    log.info(`delta ${delta.id} [${ops.map((o) => `${o.op} ${o.path}`).join(", ")}]`);
    serverRef.publish(opts.channel, JSON.stringify(delta));
    persist();
    return delta;
  }

  return {
    getDoc(): T { return doc; },
    setDoc(d: T) { doc = d; },
    persist,
    applyAndBroadcast,
    setServer(s: ReturnType<typeof Bun.serve>) { serverRef = s; },
    channel: opts.channel,

    routes: {
      [`${prefix}/api/data`]: {
        GET: () => {
          log.info(`GET ${prefix}/api/data`);
          return Response.json(doc);
        },
        async POST(req: Request) {
          const body = await req.json() as { ops: DeltaOp[] };
          const delta = applyAndBroadcast(body.ops);
          return Response.json(delta);
        },
      },
      [`${prefix}/ws`]: (req: Request, server: any) => {
        const clientId = new URL(req.url).searchParams.get("clientId") ?? crypto.randomUUID();
        if (server.upgrade(req, { data: { clientId, channels: [opts.channel] } })) return;
        return new Response("WebSocket upgrade failed", { status: 400 });
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Client store
// ---------------------------------------------------------------------------

interface ClientStoreOptions {
  apiPath: string;  // e.g. "/api/data" or "/accl/api/data"
  wsPath: string;   // e.g. "/ws" or "/accl/ws"
  clientId?: string; // optional client identity for targeted messages
  onMessage?: (msg: any) => boolean; // return true to consume (skip delta apply)
  onOpen?: () => void;
  onClose?: () => void;
}

export function createClientStore<T>(opts: ClientStoreOptions) {
  const data = signal<T | null>(null);
  const dataVersion = signal(0);
  const connected = signal(false);
  const wsQuery = opts.clientId ? `?clientId=${opts.clientId}` : "";

  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = reconnectingWebSocket(`${proto}//${location.host}${opts.wsPath}${wsQuery}`);

  ws.addEventListener("open", () => {
    connected.set(true);
    opts.onOpen?.();
  });
  ws.addEventListener("message", ((ev: MessageEvent) => {
    const msg = JSON.parse(ev.data);
    if (opts.onMessage?.(msg)) return;
    if (!data.peek()) return;
    applyOps(data.peek()!, msg.ops);
    data.set(structuredClone(data.peek()!));
    dataVersion.set(dataVersion.peek() + 1);
  }) as EventListener);

  async function init() {
    const res = await fetch(opts.apiPath);
    data.set(await res.json());
  }

  async function sendDelta(ops: DeltaOp[]) {
    await fetch(opts.apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops }),
    });
  }

  return { data, dataVersion, connected, sendDelta, init };
}
