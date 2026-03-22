import { signal } from "@blueshed/railroad/signals";
import { tryInject, WS } from "@lib/shared";

export type Message = { message: string };

export const message = signal<Message | null>(null);

export async function loadMessage() {
  const res = await fetch("/api/message");
  message.set(await res.json());
}

export async function saveMessage(body: Message) {
  await fetch("/api/message", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  message.set(body);
}

export function connectMessage() {
  const ws = tryInject(WS);
  if (!ws) return () => {};
  ws.send(JSON.stringify({ action: "opendoc", resource: "message" }));
  const handler = (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.resource === "message" && msg.action === "update")
        message.set(msg.item);
    } catch {}
  };
  ws.addEventListener("message", handler);
  return () => {
    ws.removeEventListener("message", handler);
    ws.send(JSON.stringify({ action: "closedoc", resource: "message" }));
  };
}
