/**
 * Reconnecting WebSocket — drop-in wrapper that auto-reconnects on close.
 *
 * Usage:
 *   const ws = reconnectingWebSocket("ws://localhost:3000/ws");
 *   ws.addEventListener("message", (e) => console.log(e.data));
 *   ws.send(JSON.stringify({ action: "open", doc: "notes" }));
 *
 * Behavior:
 *   - Returns an EventTarget proxy that looks like a native WebSocket
 *   - On disconnect, reconnects with exponential backoff (500ms → 30s)
 *   - Fires open/close/message/error events on the proxy
 */
export function reconnectingWebSocket(url: string): WebSocket {
  let ws!: WebSocket;
  const proxy = new EventTarget();
  let backoff = 500;

  function connect() {
    ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      backoff = 500;
      proxy.dispatchEvent(new Event("open"));
    });
    ws.addEventListener("message", (e: MessageEvent) => {
      proxy.dispatchEvent(new MessageEvent("message", { data: e.data }));
    });
    ws.addEventListener("close", () => {
      proxy.dispatchEvent(new Event("close"));
      setTimeout(connect, (backoff = Math.min(backoff * 2, 30_000)));
    });
    ws.addEventListener("error", () => {
      proxy.dispatchEvent(new Event("error"));
    });
  }

  (proxy as any).send = (data: string) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  };

  Object.defineProperty(proxy, "readyState", {
    get: () => ws.readyState,
  });

  connect();
  return proxy as unknown as WebSocket;
}
