/** Drop-in reconnecting WebSocket wrapper. Transparent to consumers. */
export function reconnectingWebSocket(url: string): WebSocket {
  let ws!: WebSocket;
  const proxy = new EventTarget();
  const subscriptions = new Set<string>();
  let backoff = 500;

  function connect() {
    ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      backoff = 500;
      for (const resource of subscriptions) {
        ws.send(JSON.stringify({ action: "opendoc", resource }));
      }
      proxy.dispatchEvent(new Event("open"));
    });
    ws.addEventListener("message", (e: MessageEvent) => {
      proxy.dispatchEvent(new MessageEvent("message", { data: e.data }));
    });
    ws.addEventListener("close", () => {
      setTimeout(connect, (backoff = Math.min(backoff * 2, 30_000)));
    });
  }

  (proxy as any).send = (data: string) => {
    try {
      const msg = JSON.parse(data);
      if (msg.action === "opendoc") subscriptions.add(msg.resource);
      if (msg.action === "closedoc") subscriptions.delete(msg.resource);
    } catch {}
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  };

  Object.defineProperty(proxy, "readyState", { get: () => ws.readyState });

  connect();
  return proxy as unknown as WebSocket;
}
