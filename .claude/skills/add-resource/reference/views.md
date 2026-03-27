# View component patterns

Views are JSX functional components with an inline delta-doc client store. No separate store file needed. Railroad's router manages dispose scopes automatically — effects created during component render are cleaned up on route change.

## Singleton component

One file: `{name}-view.tsx`. The client store is created at module level.

```tsx
import { effect } from "@blueshed/railroad/signals";
import { createClientStore } from "@lib/delta-doc";
import { toast } from "@lib/toast";

type {Name}Doc = { {field}: string };

const { data, sendDelta, init } = createClientStore<{Name}Doc>({
  apiPath: "/api/data",
  wsPath: "/ws",
});

export function {Name}View() {
  let input: HTMLInputElement;

  effect(() => {
    const doc = data.get();
    if (doc && input) input.value = doc.{field};
  });
  init();

  async function save() {
    await sendDelta([{ op: "replace", path: "/{field}", value: input.value }]);
    toast("Saved");
  }

  return (
    <>
      <input type="text" ref={(el: HTMLInputElement) => { input = el; }} onkeydown={(e: KeyboardEvent) => {
        if (e.key === "Enter" && e.metaKey) save();
      }} />
      <div class="toolbar">
        <button class="primary" onclick={save}>Save</button>
      </div>
    </>
  );
}
```

## Collection components

One file: `{name}-view.tsx` with two exports. Store at module level, shared between list and detail.

```tsx
import { createClientStore } from "@lib/delta-doc";
import { when, list, navigate } from "@blueshed/railroad";
import { toast } from "@lib/toast";

type {Name} = { id: string; title: string; createdAt: string };
type {Name}Doc = { items: {Name}[] };

const { data, sendDelta, init } = createClientStore<{Name}Doc>({
  apiPath: "/{names}/api/data",
  wsPath: "/{names}/ws",
});
init();
```

### List component

```tsx
export function {Name}List() {
  return (
    <>
      <div class="toolbar">
        <h1>{Name}s</h1>
        <button class="primary" onclick={() => {
          const item = { id: crypto.randomUUID(), title: "Untitled", createdAt: new Date().toISOString() };
          sendDelta([{ op: "add", path: "/items/-", value: item }]);
          navigate(`/{names}/${item.id}`);
        }}>+ New</button>
      </div>
      {when(
        () => (data.get()?.items.length ?? 0) > 0,
        () => (
          <ul class="list">
            {list(() => data.get()!.items, (t) => t.id, (t) => (
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

### Detail component

```tsx
export function {Name}Detail({ id }: { id: string }) {
  return when(
    () => data.get()?.items.find(n => n.id === id),
    () => {
      const items = data.get()!.items;
      const idx = items.findIndex(n => n.id === id);
      const item = items[idx];
      let titleInput: HTMLInputElement;

      async function save() {
        await sendDelta([{ op: "replace", path: `/items/${idx}/title`, value: titleInput.value }]);
        toast("Saved");
      }

      return (
        <>
          <a class="back" href="#/{names}">&larr; {Name}s</a>
          <h1>Edit {Name}</h1>
          <form onsubmit={(e: Event) => { e.preventDefault(); save(); }}>
            <label>Title
              <input type="text" value={item.title}
                ref={(el: HTMLInputElement) => { titleInput = el; }} />
            </label>
            <div class="toolbar">
              <button type="submit" class="primary">Save</button>
              <button type="button" class="danger" onclick={() => {
                sendDelta([{ op: "remove", path: `/items/${idx}` }]);
                toast("Deleted", "alert");
                navigate("/{names}");
              }}>Delete</button>
            </div>
          </form>
        </>
      );
    }
  );
}
```

## Reactivity rules

1. **Components run once.** Reactivity comes from signals, not re-calling the component.
2. **Use `{() => expr}` in JSX** for reactive text — creates an effect-backed text node.
3. **Use `text()`** for computed text outside JSX children.
4. **Use `when()`** for conditional rendering and `list()` for collections.
5. **Use `effect()`** to bridge signals to imperative DOM (e.g., setting input values).
6. **Cleanup is automatic** — the router's dispose scope handles it.

## CSS classes (from `/sample`)

- `.toolbar` — flex row with gap, use with `.primary` and `.danger` buttons
- `.list` — unstyled list, `.list a` — flex row for items
- `.empty` — centered muted text for empty states
- `.back` — small muted link for navigation
- `label` — block label wrapping input/textarea
- `.help` — muted help text
- `.meta` — small metadata text

## Route wiring in app.tsx

```tsx
import { {Name}View } from "./resources/{name}/{name}-view";
// or for collections:
import { {Name}List, {Name}Detail } from "./resources/{name}/{name}-view";

routes(app, {
  "/{name}": () => <{Name}View />,
  // or for collections:
  "/{names}": () => <{Name}List />,
  "/{names}/:id": ({ id }) => <{Name}Detail id={id} />,
});
```
