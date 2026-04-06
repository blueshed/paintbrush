import { when, computed } from "@blueshed/railroad";
import { signal } from "@blueshed/railroad/signals";
import { call } from "@blueshed/railroad/delta-client";
import type { Status } from "./status-api";

const status = signal<Status | null>(null);

function loadStatus() {
  call<Status>("status").then((s) => status.set(s));
}

export function StatusView() {
  loadStatus();

  return when(
    () => status.get(),
    () => (
      <div onclick={() => loadStatus()} style="cursor:pointer">
        <p class="help">
          Your data is stored at <code>{computed(() => status.get()!.dataPath)}</code>
          {computed(() => status.get()!.persistent
            ? " on a mounted volume — it survives redeploys."
            : " (ephemeral — will reset on redeploy).")}
        </p>
        <p class="meta">{computed(() => `Uptime ${status.get()!.uptime}s · Bun ${status.get()!.bun}`)}</p>
      </div>
    )
  );
}
