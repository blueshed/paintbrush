import { signal } from "@blueshed/railroad";
import type { Message } from "./message-api";

/** The message as the server last said it; null until the first load. */
export const message = signal<Message | null>(null);

export async function load() {
  const res = await fetch("/api/message");
  if (!res.ok) throw new Error(`GET /api/message answered ${res.status}`);
  message.set((await res.json()) as Message);
}

export async function save(text: string) {
  const res = await fetch("/api/message", { method: "PUT", body: JSON.stringify({ message: text }) });
  if (!res.ok) throw new Error(`PUT /api/message answered ${res.status}`);
  message.set((await res.json()) as Message);
}

// Every save, from any page, arrives on the socket. A socket that closes (a deploy, a restart)
// is opened again, and the message loaded again, since a save may have been missed meanwhile.
function listen(again = false) {
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  ws.onopen = () => again && load().catch(() => {});
  ws.onmessage = (e) => message.set(JSON.parse(e.data) as Message);
  ws.onclose = () => setTimeout(() => listen(true), 1_000);
}
listen();
