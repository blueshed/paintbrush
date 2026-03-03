import { signal } from "../../lib/signals";
import { tryInject } from "../../lib/shared";

export type Message = { message: string };
export type Status = { dataPath: string; persistent: boolean; uptime: number; bun: string };

export const message = signal<Message | null>(null);
export const status = signal<Status | null>(null);

export async function loadMessage() {
  const [msgRes, statusRes] = await Promise.all([
    fetch("/api/message"),
    fetch("/api/status"),
  ]);
  message.set(await msgRes.json());
  status.set(await statusRes.json());
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
  const ws = tryInject<WebSocket>("ws");
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
