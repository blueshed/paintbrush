import { navigate } from "@blueshed/railroad/routes";
import { signal } from "@blueshed/railroad/signals";

export function AdminView() {
  let fileInput: HTMLInputElement;
  const status = signal("");

  function restore(file: File) {
    status.set("Restoring\u2026");
    file.arrayBuffer()
      .then((buf) => fetch("/admin/restore", { method: "POST", body: buf }))
      .then((res) => res.json())
      .then((body: any) => status.set(body.ok ? "Restored." : "Restore failed."))
      .catch(() => status.set("Restore failed."));
  }

  return (
    <>
      <a class="back" onclick={() => navigate("/")}>← Home</a>
      <h1>Admin</h1>
      <div class="toolbar">
        <a class="primary" href="/admin/backup" download="app.db">Download Backup</a>
      </div>
      <div class="drop-zone"
        onclick={() => fileInput.click()}
        ondragover={(e: DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.add("drag-over");
        }}
        ondragleave={(e: DragEvent) => {
          (e.currentTarget as HTMLElement).classList.remove("drag-over");
        }}
        ondrop={(e: DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove("drag-over");
          if (e.dataTransfer?.files[0]) restore(e.dataTransfer.files[0]);
        }}>
        <p>Drop a backup file here to restore</p>
        <input type="file" accept=".db" hidden
          ref={(el: HTMLInputElement) => { fileInput = el; }}
          onchange={(e: Event) => {
            const input = e.target as HTMLInputElement;
            if (input.files?.[0]) restore(input.files[0]);
          }} />
      </div>
      <div class="meta">{status}</div>
    </>
  );
}
