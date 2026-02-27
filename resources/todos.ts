import { Signal, signal, batch, type Dispose } from "../lib/signals";
import type { Todo } from "./todos-api";

export type { Todo };

// ── REST wrappers ──

export async function loadTodos(): Promise<Todo[]> {
  const res = await fetch("/api/todos");
  if (!res.ok) return [];
  return res.json();
}

export async function loadTodo(id: string): Promise<Todo | null> {
  const res = await fetch(`/api/todos/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createTodo(todo: { title: string }): Promise<Todo> {
  const res = await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });
  return res.json();
}

export async function saveTodo(todo: Partial<Todo> & { id: string }): Promise<Todo> {
  const res = await fetch(`/api/todos/${todo.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });
  return res.json();
}

export async function deleteTodo(id: string): Promise<void> {
  await fetch(`/api/todos/${id}`, { method: "DELETE" });
}

// ── Live signal store via WebSocket ──

function wsSend(ws: WebSocket, msg: object) {
  const data = JSON.stringify(msg);
  if (ws.readyState === WebSocket.OPEN) ws.send(data);
  else ws.addEventListener("open", () => ws.send(data), { once: true });
}

export function connectTodos(ws: WebSocket): { todos: Signal<Map<string, Signal<Todo>>>; dispose: Dispose } {
  const todoMap = signal(new Map<string, Signal<Todo>>());

  function onMessage(e: MessageEvent) {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.resource !== "todos") return;

    batch(() => {
      if (msg.action === "create") {
        todoMap.update((m) => new Map(m).set(msg.item.id, signal(msg.item)));
      }
      if (msg.action === "update") {
        const s = todoMap.peek().get(msg.id);
        if (s) s.update((todo) => ({ ...todo, ...msg.fields }));
      }
      if (msg.action === "delete") {
        todoMap.update((m) => { const n = new Map(m); n.delete(msg.id); return n; });
      }
    });
  }

  // Subscribe after initial load to avoid race condition
  loadTodos().then((items) => {
    batch(() => {
      const map = new Map<string, Signal<Todo>>();
      for (const item of items) map.set(item.id, signal(item));
      todoMap.set(map);
    });
    wsSend(ws, { action: "opendoc", resource: "todos" });
    ws.addEventListener("message", onMessage);
  });

  return {
    todos: todoMap,
    dispose() {
      ws.removeEventListener("message", onMessage);
      wsSend(ws, { action: "closedoc", resource: "todos" });
    },
  };
}
