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
tryInject(SERVER)?.publish(
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

## Wiring

### server.ts

```ts
// Import handlers
import { get{Name}s, get{Name}, create{Name}, update{Name}, delete{Name} } from "./resources/{name}/{name}-api";

// Add to routes (before "/*" catch-all), wrapped with loggedRequest
"/api/{names}": { GET: loggedRequest("[api]", get{Name}s), POST: loggedRequest("[api]", create{Name}) },
"/api/{names}/:id": { GET: loggedRequest("[api]", get{Name}), PUT: loggedRequest("[api]", update{Name}), DELETE: loggedRequest("[api]", delete{Name}) },

// If real-time, add to topics Set
const topics = new Set(["message", "{names}"]);
```

### app.tsx

```tsx
// Import view components
import { {Name}List, {Name}Detail } from "./resources/{name}/{name}-view";

// Add to routes()
"/{names}": () => <{Name}List />,
"/{names}/:id": ({ id }) => <{Name}Detail id={id} />,
```
