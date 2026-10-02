import { when } from "@blueshed/railroad";
import { status } from "./store";

export function StatusView() {
  status.load();

  return (
    <div id="status">
      {when(status.failed, () => <p class="help">The status could not be loaded.</p>)}
      {when(status.data, (s$) => (
        <>
          <p class="help">
            {s$.map((s) =>
              s.persistent
                ? "Your data is on a mounted volume: it survives redeploys."
                : "Your data is ephemeral: it resets on redeploy.",
            )}
          </p>
          <p class="meta">{s$.map((s) => `Uptime ${s.uptime}s · Bun ${s.bun}`)}</p>
        </>
      ))}
    </div>
  );
}
