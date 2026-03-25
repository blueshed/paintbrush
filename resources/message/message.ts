import { signal } from "@blueshed/railroad/signals";
import { connectResource } from "@lib/shared";

export type Message = { message: string };
export const message = signal<Message | null>(null);

export const loadMessage = () =>
  fetch("/api/message").then(r => r.json()).then(d => message.set(d));

export const saveMessage = (body: Message) =>
  fetch("/api/message", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(() => message.set(body));

export const connectMessage = () =>
  connectResource("message", (msg) => {
    if (msg.action === "update") message.set(msg.item);
  });
