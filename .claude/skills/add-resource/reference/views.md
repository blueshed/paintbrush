# View component patterns

Views are JSX functional components. No shadow DOM, no custom elements. Railroad's router manages dispose scopes automatically — effects created during component render are cleaned up on route change.

For collections, export two components from `{name}-view.tsx`: `{Name}List` and `{Name}Detail`.

## Imports

```tsx
import { signal, effect } from "@blueshed/railroad/signals";
import { when, list, text, navigate } from "@blueshed/railroad";
import { toast } from "@lib/toast";
// import store functions from "./{name}"
```

No JSX imports needed — `tsconfig.json` sets `jsxImportSource: "@blueshed/railroad"`.

## Singleton component (like MessageView)

```tsx
export function {Name}View() {
  let ta: HTMLTextAreaElement;

  // WS cleanup is tracked via effect's dispose scope
  effect(() => connect{Name}());
  effect(() => {
    const data = {name}.get();
    if (data && ta) ta.value = data.{field};
  });
  load{Name}();

  async function save() {
    await save{Name}({ {field}: ta.value });
    toast("Saved");
  }

  return (
    <>
      <textarea ref={(el: HTMLTextAreaElement) => { ta = el; }} onkeydown={(e: KeyboardEvent) => {
        if (e.key === "Enter" && e.metaKey) save();
      }}></textarea>
      <div class="toolbar">
        <button class="primary" onclick={save}>Save</button>
      </div>
    </>
  );
}
```

## List component (`{Name}List`)

```tsx
export function {Name}List() {
  // WS cleanup tracked via effect dispose scope
  effect(() => connect{Name}s());
  load{Name}s();

  return (
    <>
      <div class="toolbar">
        <h1>{Name}s</h1>
        <button class="primary" onclick={async () => {
          const item = await create{Name}({ title: "Untitled" });
          navigate(`/{names}/${item.id}`);
        }}>+ New</button>
      </div>
      {when(
        () => {names}.get().length > 0,
        () => (
          <ul class="list">
            {list({names}, (t) => t.id, (t) => (
              <li><a href={`#/{names}/${t.id}`}>
                <strong>{t.title}</strong>
                <small>{new Date(t.createdAt).toLocaleDateString()}</small>
              </a></li>
            ))}
          </ul>
        ),
        () => <p class="empty">No {names} yet.</p>
      )}
    </>
  );
}
```

### Key points

- `list()` with a key function (`t => t.id`) for efficient DOM diffing
- `when()` toggles between list and empty state reactively
- Links use `href="#/{names}/${id}"` — the hash router picks them up
- `effect(() => connect{Name}s())` — the return value of `connect{Name}s()` is used as effect cleanup, disposed automatically on route change

## Detail component (`{Name}Detail`)

```tsx
export function {Name}Detail({ id }: { id: string }) {
  const item = signal<{Name} | null>(null);

  load{Name}(id).then(data => {
    if (!data) { navigate("/{names}"); return; }
    item.set(data);
  });

  return when(
    () => item.get(),
    () => {
      const data = item.get()!;
      let titleInput: HTMLInputElement;

      async function save() {
        await save{Name}(id, { title: titleInput.value });
        toast("Saved");
      }

      return (
        <>
          <a class="back" href="#/{names}">&larr; {Name}s</a>
          <h1>Edit {Name}</h1>
          <form onsubmit={(e: Event) => { e.preventDefault(); save(); }}>
            <label>Title
              <input type="text" value={data.title}
                ref={(el: HTMLInputElement) => { titleInput = el; }}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter" && e.metaKey) save();
                }} />
            </label>
            {/* add label+input for each field */}
            <div class="toolbar">
              <button type="button" class="primary" onclick={save}>Save</button>
              <button type="button" class="danger" onclick={() => {
                if (confirm("Delete this {name}?")) {
                  remove{Name}(id);
                  toast("Deleted", "alert");
                  navigate("/{names}");
                }
              }}>Delete</button>
            </div>
          </form>
        </>
      );
    }
  );
}
```

### Key points

- Props are passed directly by the router: `({ id }) => <{Name}Detail id={id} />`
- `when()` shows nothing until the item loads, then renders the form
- `ref` callbacks fire during element creation — refs are set before the component returns
- Cmd+Enter to save via `onkeydown` on inputs
- `confirm()` for delete instead of toolbar swap (simpler with JSX)
- Toast styles: `"notify"` (default, orange) for save, `"alert"` (red) for delete

## Reactivity rules

1. **Components run once.** The function body executes once per mount. Reactivity comes from signals, not re-calling the component.
2. **Pass signals directly as JSX children** for reactive text: `<p>{count}</p>`, not `<p>{count.get()}</p>`.
3. **Use `text()`** for computed text: `{text(() => `${first.get()} ${last.get()}`)}`.
4. **Use `when()`** for conditional rendering and `list()` for collections.
5. **Use `effect()`** to bridge signals to imperative DOM (e.g., setting textarea value).
6. **Cleanup is automatic** — the router's dispose scope cleans up all effects created during the component's render. Use `effect(() => connectFn())` to register WS cleanup in the dispose scope.

## CSS classes (from `sample.html`)

- `.toolbar` — flex row with gap, use with `.primary` and `.danger` buttons
- `.list` — unstyled list, `.list a` — flex row for items
- `.empty` — centered muted text for empty states
- `.back` — small muted link for navigation
- `label` — block label wrapping input/textarea
- `.badge` — small pill for counts
- `.help` — muted help text
- `.meta` — small metadata text

## Route wiring in app.tsx

```tsx
// Import components
import { {Name}List, {Name}Detail } from "./resources/{name}/{name}-view";

// Add to routes()
"/{names}": () => <{Name}List />,
"/{names}/:id": ({ id }) => <{Name}Detail id={id} />,
```
