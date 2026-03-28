/**
 * Paintbrush-WS — shared WebSocket protocol layer.
 *
 * Server: action routing, Bun publish/subscribe, upgrade handler.
 * Client: reconnecting socket, request/response by ID, channel notifications.
 *
 * This is the pipe. Consumers (docs, methods, streams) register actions
 * and use publish/subscribe. They don't own the WebSocket.
 *
 * Server usage:
 *   const ws = createWs();
 *   ws.on("ping", (msg, client, respond) => respond({ result: "pong" }));
 *   Bun.serve({ routes: { "/ws": ws.upgrade }, websocket: ws.websocket });
 *   ws.setServer(server);
 *
 *   // Targeted messaging (clientId assigned on upgrade — from ?clientId= or auto UUID)
 *   ws.sendTo(clientId, { type: "alert", text: "hello" });
 *
 *   // Raw messages (no action field) — use "_raw" pseudo-action
 *   ws.on("_raw", (msg, client, respond) => { ... });
 *
 * Client usage:
 *   const ws = connectWs("/ws", { clientId: "my-id" });
 *   const result = await ws.send({ action: "ping" });
 *   ws.on("notify", (msg) => console.log(msg));
 *   effect(() => console.log("connected:", ws.connected.get())); // reactive
 *
 * publishToSelf is enabled — the sender receives their own broadcasts.
 */
import { createLogger, signal } from "@blueshed/railroad";
import { key } from "@blueshed/railroad/shared";
import { reconnectingWebSocket } from "./reconnecting-ws";

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export type ActionHandler = (
  msg: any,
  ws: any,
  respond: (result: any) => void,
) => any | Promise<any>;

export function createWs() {
  const log = createLogger("[ws]");
  const actions = new Map<string, ActionHandler[]>();
  const clients = new Map<string, any>();
  let serverRef: any;

  return {
    /** Register an action handler. Multiple handlers per action are supported. */
    on(action: string, handler: ActionHandler) {
      if (!actions.has(action)) actions.set(action, []);
      actions.get(action)!.push(handler);
    },

    /** Publish to a Bun channel — all subscribers receive the message. */
    publish(channel: string, data: any) {
      serverRef?.publish(channel, JSON.stringify(data));
    },

    /** Send a message to a specific client by ID. */
    sendTo(clientId: string, data: any) {
      const ws = clients.get(clientId);
      if (ws?.readyState === 1) ws.send(JSON.stringify(data));
    },

    /** Set the Bun server reference (call after Bun.serve). */
    setServer(s: any) {
      serverRef = s;
    },

    /** WebSocket upgrade handler — use as a route value. */
    upgrade: (req: Request, server: any) => {
      const url = new URL(req.url, "http://localhost");
      const clientId = url.searchParams.get("clientId") ?? crypto.randomUUID();
      if (server.upgrade(req, { data: { clientId } })) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    },

    /** Bun websocket handler config — pass to Bun.serve({ websocket }). */
    websocket: {
      idleTimeout: 60,
      sendPings: true,
      publishToSelf: true,
      open(ws: any) {
        const clientId = ws.data?.clientId;
        if (clientId) clients.set(clientId, ws);
        for (const ch of ws.data?.channels ?? []) ws.subscribe(ch);
        log.debug(`open id=${clientId ?? "?"}`);
      },
      async message(ws: any, raw: any) {
        const msg = JSON.parse(String(raw));
        const { id, action } = msg;

        if (!action) {
          for (const handler of actions.get("_raw") ?? []) {
            await handler(msg, ws, () => {});
          }
          return;
        }

        try {
          const handlers = actions.get(action);
          if (!handlers?.length) {
            if (id)
              ws.send(
                JSON.stringify({
                  id,
                  error: { code: -1, message: `Unknown action: ${action}` },
                }),
              );
            return;
          }
          let responded = false;
          const respond = (response: any) => {
            if (!responded && id) {
              responded = true;
              ws.send(JSON.stringify({ id, ...response }));
            }
          };
          for (const handler of handlers) {
            await handler(msg, ws, respond);
            if (responded) break;
          }
          if (!responded && id) {
            ws.send(JSON.stringify({ id, error: { code: -1, message: `No handler matched: ${action}` } }));
          }
        } catch (err: any) {
          log.error(`error: ${err.message}`);
          if (id)
            ws.send(
              JSON.stringify({ id, error: { code: -1, message: err.message } }),
            );
        }
      },
      close(ws: any) {
        const clientId = ws.data?.clientId;
        if (clientId) clients.delete(clientId);
        log.debug(`close id=${clientId ?? "?"}`);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export type NotifyHandler = (msg: any) => void;

export function connectWs(wsPath: string = "/ws", opts?: { clientId?: string }) {
  const log = createLogger("[ws]");
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const query = opts?.clientId ? `?clientId=${opts.clientId}` : "";
  const connected = signal(false);
  const ws = reconnectingWebSocket(
    `${proto}//${location.host}${wsPath}${query}`,
  );
  const pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: any) => void }
  >();
  const listeners = new Map<string, Set<NotifyHandler>>();
  let nextId = 1;
  let readyResolve: () => void;
  let ready = new Promise<void>((r) => {
    readyResolve = r;
  });

  ws.addEventListener("open", () => {
    log.info("connected");
    connected.set(true);
    readyResolve();
    listeners.get("open")?.forEach((fn) => fn({}));
  });

  ws.addEventListener("close", () => {
    log.info("disconnected");
    connected.set(false);
    ready = new Promise<void>((r) => {
      readyResolve = r;
    });
    listeners.get("close")?.forEach((fn) => fn({}));
  });

  ws.addEventListener(
    "message",
    ((ev: MessageEvent) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && pending.has(msg.id)) {
        // Request/response
        const { resolve, reject } = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.error) {
          log.error(`#${msg.id} error: ${msg.error.message}`);
          reject(msg.error);
        } else {
          log.debug(`#${msg.id} ack`);
          resolve(msg.result);
        }
      } else {
        // Notification — dispatch to listeners
        log.debug(`notify ${JSON.stringify(msg).slice(0, 80)}`);
        listeners.get("message")?.forEach((fn) => fn(msg));
      }
    }) as EventListener,
  );

  return {
    /** Reactive connection state. */
    connected,

    /** Send a message and await the response. */
    async send(msg: any): Promise<any> {
      await ready;
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        log.debug(`#${id} ${msg.action} ${msg.doc ?? msg.method ?? ""}`);
        ws.send(JSON.stringify({ ...msg, id }));
      });
    },

    /** Listen for events: "open", "close", "message" (notifications). */
    on(event: string, handler: NotifyHandler): () => void {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      return () => listeners.get(event)!.delete(handler);
    },
  };
}

export type WsClient = ReturnType<typeof connectWs>;
export const WS = key<WsClient>("ws");
