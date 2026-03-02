const app = document.getElementById("app")!;

async function homeView() {
  const res = await fetch("/api/message");
  const { message } = await res.json();

  app.innerHTML = `
    <h1>Paintbrush</h1>
    <textarea id="msg">${message}</textarea>
    <div class="toolbar">
      <button class="primary" id="save">Save</button>
    </div>
  `;

  document.getElementById("save")!.addEventListener("click", async () => {
    const ta = document.getElementById("msg") as HTMLTextAreaElement;
    await fetch("/api/message", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: ta.value }),
    });
  });
}

homeView();
