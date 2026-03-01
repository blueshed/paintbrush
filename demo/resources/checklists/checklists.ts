import { Signal, signal, batch, type Dispose } from "../../../lib/signals";
import type { Checklist } from "./checklists-api";

export type { Checklist };

// ── REST wrappers ──

export async function loadChecklists(): Promise<Checklist[]> {
  const res = await fetch("/api/checklists");
  if (!res.ok) return [];
  return res.json();
}

export async function loadChecklist(id: string): Promise<Checklist | null> {
  const res = await fetch(`/api/checklists/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createChecklist(data: { title: string }): Promise<Checklist> {
  const res = await fetch("/api/checklists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function saveChecklist(data: Partial<Checklist> & { id: string }): Promise<Checklist> {
  const res = await fetch(`/api/checklists/${data.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteChecklist(id: string): Promise<void> {
  await fetch(`/api/checklists/${id}`, { method: "DELETE" });
}

// ── Live signal store via WebSocket ──

function wsSend(ws: WebSocket, msg: object) {
  const data = JSON.stringify(msg);
  if (ws.readyState === WebSocket.OPEN) ws.send(data);
  else ws.addEventListener("open", () => ws.send(data), { once: true });
}

export function connectChecklists(ws: WebSocket): { checklists: Signal<Map<string, Signal<Checklist>>>; dispose: Dispose } {
  const checklistMap = signal(new Map<string, Signal<Checklist>>());

  function onMessage(e: MessageEvent) {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.resource !== "checklists") return;

    batch(() => {
      if (msg.action === "create") {
        checklistMap.update((m) => new Map(m).set(msg.item.id, signal(msg.item)));
      }
      if (msg.action === "update") {
        const s = checklistMap.peek().get(msg.id);
        if (s) s.update((item) => ({ ...item, ...msg.fields }));
      }
      if (msg.action === "delete") {
        checklistMap.update((m) => { const n = new Map(m); n.delete(msg.id); return n; });
      }
    });
  }

  // Subscribe after initial load to avoid race condition
  loadChecklists().then((items) => {
    batch(() => {
      const map = new Map<string, Signal<Checklist>>();
      for (const item of items) map.set(item.id, signal(item));
      checklistMap.set(map);
    });
    wsSend(ws, { action: "opendoc", resource: "checklists" });
    ws.addEventListener("message", onMessage);
  });

  return {
    checklists: checklistMap,
    dispose() {
      ws.removeEventListener("message", onMessage);
      wsSend(ws, { action: "closedoc", resource: "checklists" });
    },
  };
}
