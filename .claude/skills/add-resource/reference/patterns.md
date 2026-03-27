# Delta-doc resource patterns

Resources use `delta-doc.ts` for both server and client. No separate API file or store file needed — delta-doc provides routes, persistence, WebSocket broadcasting, and reactive signals.

## Server setup (`server.ts`)

Each resource gets a delta-doc server store. Spread its routes into `Bun.serve()` and call `setServer()` after.

### Singleton

```ts
import { createServerStore } from "./lib/delta-doc";

const dataDir = process.env.DATA_PATH ?? `${import.meta.dir}/resources/{name}`;
const {name}Store = await createServerStore({
  file: `${dataDir}/{name}.json`,
  channel: "{name}",
  empty: { /* default fields */ },
});

const server = Bun.serve({
  routes: {
    ...{name}Store.routes,  // adds /api/data and /ws
    // ... other routes
  },
  websocket: {
    open(ws) {
      const channels = (ws.data as any)?.channels;
      if (channels) for (const ch of channels) ws.subscribe(ch);
    },
    message() {},
  },
});

{name}Store.setServer(server);
```

### Collection

For collections, the document shape is `{ items: {Name}[] }`:

```ts
const {name}Store = await createServerStore({
  file: `${dataDir}/{names}.json`,
  channel: "{names}",
  empty: { items: [] },
  prefix: "/{names}",  // routes at /{names}/api/data, /{names}/ws
});
```

### Multiple resources

Spread multiple stores into routes:

```ts
const server = Bun.serve({
  routes: {
    ...messageStore.routes,
    ...{name}Store.routes,
    // ...
  },
});

messageStore.setServer(server);
{name}Store.setServer(server);
```

## Client store (inline in view)

Create the client store at module level in the view file:

```ts
import { createClientStore } from "@lib/delta-doc";

const { data, sendDelta, init } = createClientStore<{DocType}>({
  apiPath: "/api/data",       // or "/{names}/api/data" with prefix
  wsPath: "/ws",              // or "/{names}/ws" with prefix
});
```

Returns:
- `data` — `Signal<T | null>`, reactive document state
- `sendDelta(ops)` — POST delta operations to the server
- `init()` — fetch initial data, call once
- `dataVersion` — `Signal<number>`, increments on each delta
- `connected` — `Signal<boolean>`, WebSocket connection state

## Delta operations

Delta ops follow JSON Patch-like semantics:

| Op | Usage | Example |
|----|-------|---------|
| `replace` | Update a field | `{ op: "replace", path: "/title", value: "New" }` |
| `add` | Append to array | `{ op: "add", path: "/items/-", value: item }` |
| `remove` | Delete field or array item | `{ op: "remove", path: "/items/2" }` |

### Collection CRUD via deltas

```ts
// Create — append to items array
sendDelta([{ op: "add", path: "/items/-", value: newItem }]);

// Update — replace field at index
sendDelta([{ op: "replace", path: `/items/${idx}/title`, value: "Updated" }]);

// Delete — remove item at index
sendDelta([{ op: "remove", path: `/items/${idx}` }]);
```

### Item identity

Every collection item needs `id` and `createdAt`:

```ts
const item = {
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  ...fields,
};
```

Find items by id, get index for delta paths:

```ts
const items = data.get()!.items;
const idx = items.findIndex(n => n.id === id);
```

## Wiring in app.tsx

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
