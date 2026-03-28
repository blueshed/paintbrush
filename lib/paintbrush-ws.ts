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
 * Client usage:
 *   const ws = connectClient("/ws");
 *   const result = await ws.send({ action: "ping" });
 *   ws.on("notify", (msg) => console.log(msg));
 */
import { createLogger } from "@blueshed/railroad";
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

    /** Set the Bun server reference (call after Bun.serve). */
    setServer(s: any) {
      serverRef = s;
    },

    /** WebSocket upgrade handler — use as a route value. */
    upgrade: (req: Request, server: any) => {
      if (server.upgrade(req)) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    },

    /** Bun websocket handler config — pass to Bun.serve({ websocket }). */
    websocket: {
      idleTimeout: 60,
      sendPings: true,
      open(ws: any) {
        log.debug("open");
      },
      async message(ws: any, raw: any) {
        const msg = JSON.parse(String(raw));
        const { id, action } = msg;

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
      close() {
        log.debug("close");
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export type NotifyHandler = (msg: any) => void;

export function connectClient(wsPath: string = "/ws") {
  const log = createLogger("[ws]");
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = reconnectingWebSocket(
    `${proto}//${location.host}${wsPath}`,
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
    readyResolve();
    // Notify reconnect listeners
    listeners.get("open")?.forEach((fn) => fn({}));
  });

  ws.addEventListener("close", () => {
    log.info("disconnected");
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
