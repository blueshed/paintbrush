import { when, text } from "@blueshed/railroad";
import { status, loadStatus } from "./status";

export function StatusView() {
  loadStatus();

  return when(
    () => status.get(),
    () => (
      <div onclick={() => loadStatus()} style="cursor:pointer">
        <p class="help">
          Your data is stored at <code>{text(() => status.get()!.dataPath)}</code>
          {text(() => status.get()!.persistent
            ? " on a mounted volume — it survives redeploys."
            : " (ephemeral — will reset on redeploy).")}
        </p>
        <p class="meta">{text(() => `Uptime ${status.get()!.uptime}s · Bun ${status.get()!.bun}`)}</p>
      </div>
    )
  );
}
