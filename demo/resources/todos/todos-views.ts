import { navigate, effect, type Dispose } from "../../../lib/signals";
import { esc } from "../../../lib/utils";
import { connectTodos, createTodo, saveTodo, deleteTodo, loadTodo } from "./todos";
import type { Todo } from "./todos";

const STATUS_LABELS: Record<string, string> = { pending: "Pending", active: "Active", done: "Done" };
const STATUS_ORDER: string[] = ["pending", "active", "done"];

function nextStatus(current: string): string {
  const i = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

export function todoListView(root: HTMLElement, ws: WebSocket): Dispose | void {
  const { todos, dispose: docDispose } = connectTodos(ws);
  const disposers: Dispose[] = [];

  root.innerHTML = `
    <a class="back" id="back">&larr; Home</a>
    <h1>Todos</h1>
    <div class="toolbar"><button class="primary" id="add">New Todo</button></div>
    <ul class="todo-list" id="todo-list"></ul>
    <div class="empty" id="empty">No todos yet.</div>
  `;

  root.querySelector("#back")!.addEventListener("click", () => navigate("/"));
  root.querySelector("#add")!.addEventListener("click", async () => {
    const todo = await createTodo({ title: "Untitled" });
    navigate(`/todos/${todo.id}`);
  });

  const list = root.querySelector("#todo-list")!;
  const empty = root.querySelector("#empty") as HTMLElement;
  const liMap = new Map<string, { el: HTMLLIElement; dispose: Dispose }>();

  // Event delegation: single click handler on <ul> for both cycle and navigate
  list.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const li = target.closest("li");
    if (!li) return;
    const id = li.dataset.id!;

    // Status badge click → cycle status
    if (target.closest("[data-action=cycle]")) {
      const sig = todos.get().get(id);
      if (sig) saveTodo({ id, status: nextStatus(sig.peek().status) });
      return;
    }

    // Anywhere else on the <li> → navigate to detail
    navigate(`/todos/${id}`);
  });

  // List-level effect: tracks which todos exist
  disposers.push(effect(() => {
    const map = todos.get();

    empty.style.display = map.size === 0 ? "block" : "none";
    (list as HTMLElement).style.display = map.size === 0 ? "none" : "";

    // Remove <li>s for deleted todos
    for (const [id, entry] of liMap) {
      if (!map.has(id)) {
        entry.dispose();
        entry.el.remove();
        liMap.delete(id);
      }
    }

    // Add <li>s for new todos
    for (const [id, todoSignal] of map) {
      if (!liMap.has(id)) {
        const li = document.createElement("li");
        li.dataset.id = id;

        // Per-todo effect: updates this <li> when fields change
        const d = effect(() => {
          const t = todoSignal.get();
          li.className = `todo-item status-${t.status}`;
          li.innerHTML = `
            <span class="todo-status" data-action="cycle">${esc(STATUS_LABELS[t.status] || t.status)}</span>
            <div class="todo-content">
              <h2>${esc(t.title)}</h2>
              ${t.tags.length ? `<p class="tags">${t.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join(" ")}</p>` : ""}
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

export function todoDetailView(root: HTMLElement, id: string): Dispose | void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  loadTodo(id).then((todo) => {
    if (cancelled) return;
    if (!todo) {
      root.innerHTML = `<div class="empty">Todo not found.</div>`;
      return;
    }

    root.innerHTML = `
      <a class="back" id="back">&larr; All todos</a>
      <div class="form-group">
        <label>Title</label>
        <input id="title" value="${esc(todo.title)}">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="status">
          ${STATUS_ORDER.map((s) => `<option value="${s}"${s === todo.status ? " selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Tags (comma-separated)</label>
        <input id="tags" value="${esc(todo.tags.join(", "))}">
      </div>
      <div class="toolbar">
        <button class="danger" id="del">Delete</button>
      </div>
      <div class="meta">Created: ${todo.createdAt || "—"}</div>
    `;

    root.querySelector("#back")!.addEventListener("click", () => navigate("/todos"));

    function autosave() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const title = (root.querySelector("#title") as HTMLInputElement).value;
        const status = (root.querySelector("#status") as HTMLSelectElement).value;
        const tagsRaw = (root.querySelector("#tags") as HTMLInputElement).value;
        const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
        saveTodo({ id: todo!.id, title, status, tags });
      }, 400);
    }

    root.querySelector("#title")!.addEventListener("input", autosave);
    root.querySelector("#title")!.addEventListener("keydown", async (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        const title = (root.querySelector("#title") as HTMLInputElement).value;
        const status = (root.querySelector("#status") as HTMLSelectElement).value;
        const tagsRaw = (root.querySelector("#tags") as HTMLInputElement).value;
        const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
        await saveTodo({ id: todo!.id, title, status, tags });
        navigate("/todos");
      }
    });
    root.querySelector("#status")!.addEventListener("change", autosave);
    root.querySelector("#tags")!.addEventListener("input", autosave);

    root.querySelector("#del")!.addEventListener("click", async () => {
      await deleteTodo(todo!.id);
      navigate("/todos");
    });
  });

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
