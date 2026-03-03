import { navigate } from "../../../lib/signals";

export function adminView(root: HTMLElement): void {
  root.innerHTML = `
    <a class="back" id="back">&larr; Home</a>
    <h1>Admin</h1>
    <div class="toolbar">
      <a id="backup-btn" class="primary" href="/admin/backup" download="app.db">Download Backup</a>
    </div>
    <div class="drop-zone" id="drop-zone">
      <p>Drop a backup file here to restore</p>
      <input type="file" id="restore-file" accept=".db" hidden>
    </div>
    <div id="restore-status" class="meta"></div>
  `;

  root.querySelector("#back")!.addEventListener("click", () => navigate("/"));

  const dropZone = root.querySelector("#drop-zone") as HTMLElement;
  const fileInput = root.querySelector("#restore-file") as HTMLInputElement;
  const status = root.querySelector("#restore-status") as HTMLElement;

  function restore(file: File) {
    status.textContent = "Restoring\u2026";
    file.arrayBuffer().then((buf) =>
      fetch("/admin/restore", { method: "POST", body: buf })
    ).then((res) => res.json()).then((body: any) => {
      status.textContent = body.ok ? "Restored." : "Restore failed.";
    }).catch(() => {
      status.textContent = "Restore failed.";
    });
  }

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.[0]) restore(fileInput.files[0]);
  });
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer?.files[0]) restore(e.dataTransfer.files[0]);
  });
}
