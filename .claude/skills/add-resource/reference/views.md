# View component patterns

Views are JSX functional components that use delta-doc for data. Railroad's router manages dispose scopes automatically — effects created during component render are cleaned up on route change.

## Shared type file

Every resource starts with a shared type in `{name}-api.ts`:

```ts
/** {Name} — shared type, used by both server and client. */
export type {Name} = { {field}: string };
```

For collections:

```ts
export type {Name} = {
  id: string;
  {field}: string;
  createdAt: string;
};
```

## Singleton component

Two files: `{name}-api.ts` (type) + `{name}-view.tsx` (view). The hub connection and doc are created at module level.

```tsx
import { effect } from "@blueshed/railroad/signals";
import { connect, type DeltaOp } from "@lib/delta-doc";
import { toast } from "@lib/toast";
import type { {Name} } from "./{name}-api";

const hub = connect("/ws");
const {name} = hub.open<{Name}>("{name}");

export function {Name}View() {
  let input: HTMLInputElement;

  effect(() => {
    const doc = {name}.data.get();
    if (doc && input) input.value = doc.{field};
  });

  function save() {
    {name}.send([{ op: "replace", path: "/{field}", value: input.value }]);
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

Two files: `{name}-api.ts` (type) + `{name}-view.tsx` (view with two exports). Hub and doc at module level, shared between list and detail.

```tsx
import { when, list } from "@blueshed/railroad";
import { computed } from "@blueshed/railroad/signals";
import { connect, type DeltaOp } from "@lib/delta-doc";
import { toast } from "@lib/toast";
import type { {Name} } from "./{name}-api";

const hub = connect("/ws");
const {names} = hub.open<{ items: {Name}[] }>("{names}");
const items = computed<{Name}[]>(() => {names}.data.get()?.items ?? []);
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
          {names}.send([{ op: "add", path: "/items/-", value: item }]);
          navigate(`/{names}/${item.id}`);
        }}>+ New</button>
      </div>
      {when(
        () => (items.get().length) > 0,
        () => (
          <ul class="list">
            {list(items, (t: {Name}) => (
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
    () => {names}.data.get()?.items.find(n => n.id === id),
    () => {
      const items = {names}.data.get()!.items;
      const idx = items.findIndex(n => n.id === id);
      const item = items[idx];
      let titleInput: HTMLInputElement;

      function save() {
        {names}.send([{ op: "replace", path: `/items/${idx}/title`, value: titleInput.value }]);
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
                {names}.send([{ op: "remove", path: `/items/${idx}` }]);
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
2. **`doc.data` is a `Signal<T | null>`.** Use `.get()` in effects to track, `.peek()` in event handlers.
3. **Use `when()`** for conditional rendering and `list()` for collections.
4. **Use `effect()`** to bridge signals to imperative DOM (e.g., setting input values).
5. **Use `computed()`** to derive list signals from the doc: `computed(() => doc.data.get()?.items ?? [])`.
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
