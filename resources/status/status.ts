import { signal } from "@blueshed/railroad/signals";

export type Status = { dataPath: string; persistent: boolean; uptime: number; bun: string };
export const status = signal<Status | null>(null);

export const loadStatus = () =>
  fetch("/api/status").then(r => r.json()).then(d => status.set(d));
