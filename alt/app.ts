import type { Message } from "./resources/message";
import type { Status } from "./resources/message-api";

const app = document.getElementById("app")!;

async function homeView() {
  const [msgRes, statusRes] = await Promise.all([
    fetch("/api/message"),
    fetch("/api/status"),
  ]);
  const data: Message = await msgRes.json();
  const status: Status = await statusRes.json();

  app.innerHTML = `
    <h1>Paintbrush</h1>
    <textarea id="msg">${data.message}</textarea>
    <div class="toolbar">
      <button class="primary" id="save">Save</button>
    </div>
    <p class="help">
      Edit the message above and hit <strong>Save</strong> to persist it.
      Your data is stored at <code>${status.dataPath}</code>
      ${status.persistent ? "on a mounted volume — it survives redeploys." : "(ephemeral — will reset on redeploy)."}
    </p>
    <p class="meta">Uptime ${status.uptime}s &middot; Bun ${status.bun}</p>
  `;

  document.getElementById("save")!.addEventListener("click", async () => {
    const btn = document.getElementById("save") as HTMLButtonElement;
    const ta = document.getElementById("msg") as HTMLTextAreaElement;
    const body: Message = { message: ta.value };
    await fetch("/api/message", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    btn.textContent = "Saved!";
    setTimeout(() => (btn.textContent = "Save"), 1500);
  });
}

homeView();
