# Collection resource patterns

The starter `resources/message/` is a singleton (one document). Most resources are collections (lists of items with CRUD). This guide explains how to adapt the message pattern for collections.

## Server handlers (`{name}-api.ts`)

A singleton has `getMessage` and `putMessage`. A collection needs five handlers:

| Handler | Method | Path | Description |
|---------|--------|------|-------------|
| `get{Name}s` | GET | `/api/{names}` | List all items |
| `get{Name}` | GET | `/api/{names}/:id` | Get one by id |
| `create{Name}` | POST | `/api/{names}` | Create new item |
| `update{Name}` | PUT | `/api/{names}/:id` | Update existing |
| `delete{Name}` | DELETE | `/api/{names}/:id` | Remove item |

### Storage helpers

Replace the singleton read/write with collection helpers:

```ts
function readAll(): {Name}[] {
  return JSON.parse(readFileSync(file, "utf-8"));
}
function writeAll(items: {Name}[]) {
  writeFileSync(file, JSON.stringify(items, null, 2));
}
```

### Item identity

Every item needs `id: string` and `createdAt: string`. The create handler assigns these:

```ts
const item: {Name} = {
  ...body,
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
};
```

### Extracting `:id` from URL

Bun route params aren't passed to method handlers. Extract from pathname:

```ts
const url = new URL(req.url);
const id = url.pathname.split("/").pop()!;
```

### WebSocket notify (if real-time)

After each mutation, publish with the action type:

```ts
tryInject<any>("server")?.publish(
  "{names}",
  JSON.stringify({ resource: "{names}", action: "create", item }),
);
```

Actions: `"create"`, `"update"`, `"delete"`. For delete, send `{ resource, action: "delete", id }` instead of `item`.

## Client store (`{name}.ts`)

A singleton has one signal. A collection has:

```ts
export const {names} = signal<{Name}[]>([]);
```

### Fetch wrappers

- `load{Name}s()` — GET list, set signal
- `load{Name}(id)` — GET one, return it
- `create{Name}(data)` — POST, append to signal
- `save{Name}(id, data)` — PUT, update in signal
- `remove{Name}(id)` — DELETE, filter from signal

Each wrapper updates the signal optimistically after the fetch succeeds.

### WebSocket subscription (if real-time)

Handle three actions in the message handler:

```ts
if (msg.action === "create") {names}.set([...current, msg.item]);
if (msg.action === "update") {names}.set(current.map(x => x.id === msg.item.id ? msg.item : x));
if (msg.action === "delete") {names}.set(current.filter(x => x.id !== msg.id));
```

## Web component (`{name}-view.ts`)

For collections, create two custom elements: `{name}-list` and `{name}-detail`.

### List element

- Loads items in `connectedCallback`, renders with `effect()`
- Uses `.list` CSS class with `<li><a>` for items
- Uses `.empty` for empty state
- Has `.toolbar` with `+ New` button
- Navigates to detail view on item click (use `navigate` from `lib/routes`)

### Detail element

- Reads `data-id` attribute to know which item to load
- Form with `label > input` / `label > textarea` for fields
- Save button with `toast("Saved")` feedback
- Delete with confirm pattern (`.confirm` toolbar swap)
- `.back` link to return to list

### CSS classes (from `sample.html`)

- `.toolbar` — flex row with gap, use with `.primary` and `.danger` buttons
- `.list` — unstyled list, `.list a` — flex row for items
- `.empty` — centered muted text for empty states
- `.back` — small muted link for navigation
- `label` — block label wrapping input/textarea
- `.confirm .confirm-prompt` — inline delete confirmation text
- `.badge` — small pill for counts

## Wiring

### server.ts

```ts
// Import handlers
import { get{Name}s, get{Name}, create{Name}, update{Name}, delete{Name} } from "./resources/{name}/{name}-api";

// Add to routes (before "/*" catch-all)
"/api/{names}": { GET: get{Name}s, POST: create{Name} },
"/api/{names}/:id": { GET: get{Name}, PUT: update{Name}, DELETE: delete{Name} },

// If real-time, add to topics Set
const topics = new Set(["message", "{names}"]);
```

### app.ts

```ts
// Import view (side-effect import registers the custom element)
import "./resources/{name}/{name}-view";

// Add to routes()
"/{names}": () => "<{name}-list></{name}-list>",
"/{names}/:id": ({ id }) => `<{name}-detail data-id="${id}"></{name}-detail>`,
```
