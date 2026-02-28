import { navigate, effect, type Dispose } from "../../lib/signals";
import { esc } from "../../lib/utils";
import { connectChecklists, createChecklist, saveChecklist, deleteChecklist, loadChecklist } from "./checklists";
import type { Checklist } from "./checklists";

export function checklistListView(root: HTMLElement, ws: WebSocket): Dispose | void {
  const { checklists, dispose: docDispose } = connectChecklists(ws);
  const disposers: Dispose[] = [];

  root.innerHTML = `
    <a class="back" id="back">&larr; Home</a>
    <h1>Checklists</h1>
    <div class="toolbar"><button class="primary" id="add">New Item</button></div>
    <ul class="todo-list" id="checklist-list"></ul>
    <div class="empty" id="empty">No items yet.</div>
  `;

  root.querySelector("#back")!.addEventListener("click", () => navigate("/"));
  root.querySelector("#add")!.addEventListener("click", async () => {
    const item = await createChecklist({ title: "Untitled" });
    navigate(`/checklists/${item.id}`);
  });

  const list = root.querySelector("#checklist-list")!;
  const empty = root.querySelector("#empty") as HTMLElement;
  const liMap = new Map<string, { el: HTMLLIElement; dispose: Dispose }>();

  // Event delegation
  list.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const li = target.closest("li");
    if (!li) return;
    const id = li.dataset.id!;

    // Checkbox click → toggle checked
    if (target.closest("[data-action=toggle]")) {
      const sig = checklists.get().get(id);
      if (sig) saveChecklist({ id, checked: !sig.peek().checked });
      return;
    }

    // Anywhere else → navigate to detail
    navigate(`/checklists/${id}`);
  });

  // List-level effect: tracks which items exist
  disposers.push(effect(() => {
    const map = checklists.get();

    empty.style.display = map.size === 0 ? "block" : "none";
    (list as HTMLElement).style.display = map.size === 0 ? "none" : "";

    // Remove <li>s for deleted items
    for (const [id, entry] of liMap) {
      if (!map.has(id)) {
        entry.dispose();
        entry.el.remove();
        liMap.delete(id);
      }
    }

    // Add <li>s for new items
    for (const [id, itemSignal] of map) {
      if (!liMap.has(id)) {
        const li = document.createElement("li");
        li.dataset.id = id;

        // Per-item effect: updates this <li> when fields change
        const d = effect(() => {
          const item = itemSignal.get();
          li.className = `todo-item${item.checked ? " status-done" : ""}`;
          li.innerHTML = `
            <span class="checklist-check${item.checked ? " checked" : ""}" data-action="toggle"></span>
            <div class="todo-content">
              <h2${item.checked ? ' style="text-decoration:line-through;opacity:0.6"' : ""}>${esc(item.title)}</h2>
            </div>
          `;
        });

        liMap.set(id, { el: li, dispose: d });
        list.appendChild(li);
      }
    }
  }));

  return () => {
    for (const entry of liMap.values()) entry.dispose();
    for (const d of disposers) d();
    docDispose();
  };
}

export function checklistDetailView(root: HTMLElement, id: string): Dispose | void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  loadChecklist(id).then((item) => {
    if (cancelled) return;
    if (!item) {
      root.innerHTML = `<div class="empty">Item not found.</div>`;
      return;
    }

    root.innerHTML = `
      <a class="back" id="back">&larr; All checklists</a>
      <div class="form-group">
        <label>Title</label>
        <input id="title" value="${esc(item.title)}">
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="checked"${item.checked ? " checked" : ""}>
          Done
        </label>
      </div>
      <div class="toolbar">
        <button class="danger" id="del">Delete</button>
      </div>
      <div class="meta">Created: ${item.createdAt || "\u2014"}</div>
    `;

    root.querySelector("#back")!.addEventListener("click", () => navigate("/checklists"));

    function autosave() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const title = (root.querySelector("#title") as HTMLInputElement).value;
        const checked = (root.querySelector("#checked") as HTMLInputElement).checked;
        saveChecklist({ id: item!.id, title, checked });
      }, 400);
    }

    root.querySelector("#title")!.addEventListener("input", autosave);
    root.querySelector("#title")!.addEventListener("keydown", async (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        const title = (root.querySelector("#title") as HTMLInputElement).value;
        const checked = (root.querySelector("#checked") as HTMLInputElement).checked;
        await saveChecklist({ id: item!.id, title, checked });
        navigate("/checklists");
      }
    });
    root.querySelector("#checked")!.addEventListener("change", autosave);

    root.querySelector("#del")!.addEventListener("click", async () => {
      await deleteChecklist(item!.id);
      navigate("/checklists");
    });
  });

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
