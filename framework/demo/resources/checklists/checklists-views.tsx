import { navigate } from "@blueshed/railroad/routes";
import { signal, effect, computed } from "@blueshed/railroad/signals";
import { when, list, text } from "@blueshed/railroad";
import { inject, WS } from "../../../lib/shared";
import { connectChecklists, createChecklist, saveChecklist, deleteChecklist, loadChecklist } from "./checklists";
import type { Checklist } from "./checklists";

export function ChecklistListView() {
  const ws = inject(WS);
  const { checklists, dispose: docDispose } = connectChecklists(ws);
  effect(() => docDispose);

  type Entry = [string, import("@blueshed/railroad/signals").Signal<Checklist>];
  const entries = computed<Entry[]>(() => [...checklists.get().entries()]);

  return (
    <>
      <a class="back" onclick={() => navigate("/")}>← Home</a>
      <h1>Checklists</h1>
      <div class="toolbar">
        <button class="primary" onclick={async () => {
          const item = await createChecklist({ title: "Untitled" });
          navigate(`/checklists/${item.id}`);
        }}>New Item</button>
      </div>
      {when(
        () => checklists.get().size === 0,
        () => <div class="empty">No items yet.</div>,
        () => (
          <ul class="todo-list">
            {list(
              entries,
              (e: Entry) => e[0],
              (e: Entry) => {
                const [id, itemSignal] = e;
                return (
                  <li class={computed(() => `todo-item${itemSignal.get().checked ? " status-done" : ""}`)}>
                    <span class={computed(() => `checklist-check${itemSignal.get().checked ? " checked" : ""}`)}
                      onclick={(ev: Event) => {
                        ev.stopPropagation();
                        saveChecklist({ id, checked: !itemSignal.peek().checked });
                      }}></span>
                    <div class="todo-content" onclick={() => navigate(`/checklists/${id}`)}>
                      <h2 style={computed(() => itemSignal.get().checked
                        ? "text-decoration:line-through;opacity:0.6" : "")}>
                        {text(() => itemSignal.get().title)}
                      </h2>
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

export function ChecklistDetailView({ id }: { id: string }) {
  const data = signal<Checklist | null | undefined>(undefined);
  let titleEl: HTMLInputElement;
  let checkedEl: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | null = null;

  loadChecklist(id).then((item) => data.set(item ?? null));

  effect(() => () => { if (timer) clearTimeout(timer); });

  return when(
    () => data.get() !== undefined,
    () => {
      const item = data.get();
      if (!item) return <div class="empty">Item not found.</div>;

      function autosave() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          saveChecklist({ id, title: titleEl.value, checked: checkedEl.checked });
        }, 400);
      }

      return (
        <>
          <a class="back" onclick={() => navigate("/checklists")}>← All checklists</a>
          <div class="form-group">
            <label>Title</label>
            <input value={item.title}
              ref={(el: HTMLInputElement) => { titleEl = el; }}
              oninput={autosave}
              onkeydown={async (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  await saveChecklist({ id, title: titleEl.value, checked: checkedEl.checked });
                  navigate("/checklists");
                }
              }} />
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" checked={item.checked}
                ref={(el: HTMLInputElement) => { checkedEl = el; }}
                onchange={autosave} />
              Done
            </label>
          </div>
          <div class="toolbar">
            <button class="danger" onclick={async () => {
              await deleteChecklist(id);
              navigate("/checklists");
            }}>Delete</button>
          </div>
          <div class="meta">Created: {item.createdAt || "—"}</div>
        </>
      );
    },
  );
}
