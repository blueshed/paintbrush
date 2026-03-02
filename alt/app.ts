import type { Message } from "./resources/message";

const app = document.getElementById("app")!;

async function homeView() {
  const res = await fetch("/api/message");
  const data: Message = await res.json();

  app.innerHTML = `
    <h1>Paintbrush</h1>
    <textarea id="msg">${data.message}</textarea>
    <div class="toolbar">
      <button class="primary" id="save">Save</button>
    </div>
  `;

  document.getElementById("save")!.addEventListener("click", async () => {
    const ta = document.getElementById("msg") as HTMLTextAreaElement;
    const body: Message = { message: ta.value };
    await fetch("/api/message", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

homeView();
