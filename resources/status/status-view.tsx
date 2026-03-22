import { when } from "@blueshed/railroad";
import { status, loadStatus } from "./status";

export function StatusView() {
  loadStatus();

  return when(
    () => status.get(),
    () => {
      const s = status.get()!;
      return (
        <>
          <p class="help">
            Your data is stored at <code>{s.dataPath}</code>
            {s.persistent
              ? " on a mounted volume — it survives redeploys."
              : " (ephemeral — will reset on redeploy)."}
          </p>
          <p class="meta">Uptime {s.uptime}s · Bun {s.bun}</p>
        </>
      );
    }
  );
}
