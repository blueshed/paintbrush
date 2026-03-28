# Delta-doc resource patterns

Resources use `delta-doc.ts` (over `paintbrush-ws.ts`) for both server and client. The shared type in `{name}-api.ts` is the contract — imported by both sides.

## Server setup (`server.ts`)

Each resource registers with the shared paintbrush-ws server. Import the shared type for type safety.

### Singleton

```ts
import { createWs } from "./lib/paintbrush-ws";
import { registerDoc } from "./lib/delta-doc";
import type { {Name} } from "./resources/{name}/{name}-api";

const ws = createWs();

const dataDir = process.env.DATA_PATH ?? `${import.meta.dir}/resources/{name}`;
await registerDoc<{Name}>(ws, "{name}", {
  file: `${dataDir}/{name}.json`,
  empty: { /* default fields */ },
});

const server = Bun.serve({
  routes: {
    "/ws": ws.upgrade,
    // ... other routes
  },
  websocket: ws.websocket,
});
ws.setServer(server);
```

### Collection

For collections, the document shape wraps items: `{ items: {Name}[] }`:

```ts
await registerDoc<{ items: {Name}[] }>(ws, "{names}", {
  file: `${dataDir}/{names}.json`,
  empty: { items: [] },
});
```

### Stateless methods

For read-only or computed data (not persisted), use `registerMethod()`:

```ts
import { registerMethod } from "./lib/delta-doc";

registerMethod(ws, "status", (): Status => ({
  uptime: Math.floor(process.uptime()),
  bun: Bun.version,
}));
```

## Client usage (in view files)

Connect and open the doc:

```ts
import { connect, type DeltaOp } from "@lib/delta-doc";

const hub = connect("/ws");
const {name} = hub.open<{Name}>("{name}");

// Read: {name}.data is a Signal<T | null>
effect(() => {
  const doc = {name}.data.get();
  if (doc) console.log(doc.{field});
});

// Write: {name}.send(ops) sends delta ops
{name}.send([{ op: "replace", path: "/{field}", value: "new value" }]);

// Stateless call:
const status = await hub.call<Status>("status");
```

## Delta operations

Three ops, JSON Pointer paths (`/`-separated, numeric for array index, `-` for append):

| Op | Usage | Example |
|----|-------|---------|
| `replace` | Set a value at path | `{ op: "replace", path: "/title", value: "New" }` |
| `add` | Append to array | `{ op: "add", path: "/items/-", value: item }` |
| `remove` | Delete by index | `{ op: "remove", path: "/items/2" }` |

Multiple ops in one `send()` are atomic — applied, persisted, and broadcast together.

### Collection CRUD via delta ops

```ts
// Create — append to items array
{name}.send([{ op: "add", path: "/items/-", value: newItem }]);

// Update — replace field at index
{name}.send([{ op: "replace", path: `/items/${idx}/title`, value: "Updated" }]);

// Delete — remove item at index
{name}.send([{ op: "remove", path: `/items/${idx}` }]);
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
const items = {name}.data.get()!.items;
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
