import { navigate } from "@blueshed/railroad/routes";
import { signal, effect, computed } from "@blueshed/railroad/signals";
import { when, list, text } from "@blueshed/railroad";
import { inject, WS } from "../../../lib/shared";
import { connectTodos, createTodo, saveTodo, deleteTodo, loadTodo } from "./todos";
import type { Todo } from "./todos";

const STATUS_LABELS: Record<string, string> = { pending: "Pending", active: "Active", done: "Done" };
const STATUS_ORDER: string[] = ["pending", "active", "done"];

function nextStatus(current: string): string {
  const i = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

export function TodoListView() {
  const ws = inject(WS);
  const { todos, dispose: docDispose } = connectTodos(ws);
  effect(() => docDispose);

  type Entry = [string, import("@blueshed/railroad/signals").Signal<Todo>];
  const entries = computed<Entry[]>(() => [...todos.get().entries()]);

  return (
    <>
      <a class="back" onclick={() => navigate("/")}>← Home</a>
      <h1>Todos</h1>
      <div class="toolbar">
        <button class="primary" onclick={async () => {
          const todo = await createTodo({ title: "Untitled" });
          navigate(`/todos/${todo.id}`);
        }}>New Todo</button>
      </div>
      {when(
        () => todos.get().size === 0,
        () => <div class="empty">No todos yet.</div>,
        () => (
          <ul class="todo-list">
            {list(
              entries,
              (e: Entry) => e[0],
              (e: Entry) => {
                const [id, todoSignal] = e;
                return (
                  <li class={computed(() => `todo-item status-${todoSignal.get().status}`)}
                    onclick={() => navigate(`/todos/${id}`)}>
                    <span class="todo-status" onclick={(ev: Event) => {
                      ev.stopPropagation();
                      saveTodo({ id, status: nextStatus(todoSignal.peek().status) });
                    }}>{text(() => STATUS_LABELS[todoSignal.get().status] || todoSignal.get().status)}</span>
                    <div class="todo-content">
                      <h2>{text(() => todoSignal.get().title)}</h2>
                      {when(
                        () => todoSignal.get().tags.length > 0,
                        () => (
                          <p class="tags">
                            {text(() => todoSignal.get().tags.map((t: string) => t).join(", "))}
                          </p>
                        ),
                      )}
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        ),
      )}
    </>
  );
}

export function TodoDetailView({ id }: { id: string }) {
  const data = signal<Todo | null | undefined>(undefined);
  let titleEl: HTMLInputElement;
  let statusEl: HTMLSelectElement;
  let tagsEl: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | null = null;

  loadTodo(id).then((t) => data.set(t ?? null));

  effect(() => () => { if (timer) clearTimeout(timer); });

  return when(
    () => data.get() !== undefined,
    () => {
      const todo = data.get();
      if (!todo) return <div class="empty">Todo not found.</div>;

      function autosave() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          const tags = tagsEl.value.split(",").map((t) => t.trim()).filter(Boolean);
          saveTodo({ id, title: titleEl.value, status: statusEl.value, tags });
        }, 400);
      }

      return (
        <>
          <a class="back" onclick={() => navigate("/todos")}>← All todos</a>
          <div class="form-group">
            <label>Title</label>
            <input value={todo.title}
              ref={(el: HTMLInputElement) => { titleEl = el; }}
              oninput={autosave}
              onkeydown={async (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const tags = tagsEl.value.split(",").map((t) => t.trim()).filter(Boolean);
                  await saveTodo({ id, title: titleEl.value, status: statusEl.value, tags });
                  navigate("/todos");
                }
              }} />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select ref={(el: HTMLSelectElement) => { statusEl = el; }} onchange={autosave}>
              {STATUS_ORDER.map((s) => (
                <option value={s} selected={s === todo.status}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div class="form-group">
            <label>Tags (comma-separated)</label>
            <input value={todo.tags.join(", ")}
              ref={(el: HTMLInputElement) => { tagsEl = el; }}
              oninput={autosave} />
          </div>
          <div class="toolbar">
            <button class="danger" onclick={async () => {
              await deleteTodo(id);
              navigate("/todos");
            }}>Delete</button>
          </div>
          <div class="meta">Created: {todo.createdAt || "—"}</div>
        </>
      );
    },
  );
}
