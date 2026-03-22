import { signal } from "@blueshed/railroad/signals";

export type Status = { dataPath: string; persistent: boolean; uptime: number; bun: string };

export const status = signal<Status | null>(null);

export async function loadStatus() {
  const res = await fetch("/api/status");
  status.set(await res.json());
}
