# CQRS Patterns

Two patterns for real-time apps built on Paintbrush. Both separate writes (commands via CRUD endpoints) from reads (state pushed to clients via WebSocket). They differ in granularity.

---

## Pattern 1: Granular Events (built-in)

This is what Paintbrush does out of the box. After every write, the server publishes a small delta event. Clients apply it as a patch to their local signal store. No full reload.

### Flow

```
 Client                        Server
 ──────                        ──────
 PUT /api/todos/:id    ──────▶ store.write()
   { done: true }                  │
                                   ▼
                              server.publish("todos", {
                                resource: "todos",
                                action: "update",
                                id: "abc",
                                fields: { done: true }
                              })
                                   │
 todoSignal.update(            ◀───┘
   todo => ({...todo, done: true})
 )
   │
   ▼
 effect() re-renders
 only the changed item
```

### Event shapes

Three event types, published automatically by `buildRoutes()` for any `@Resource` with `notify`:

```typescript
// After POST
{ resource: "todos", action: "create", item: { id, title, done, ... } }

// After PUT
{ resource: "todos", action: "update", id: "abc", fields: { done: true } }

// After DELETE
{ resource: "todos", action: "delete", id: "abc" }
```

### Server: declare a notified resource

```typescript
@Resource("/api/todos", sqliteStore("todos"), { notify: "todos" })
class Todo {
  @Field({ required: true }) accessor title: string = "";
  @Field() accessor done: boolean = false;
}
```

That's it. `buildRoutes()` handles publishing after every write. The client subscribes via the WebSocket `opendoc`/`closedoc` protocol.

### Client: nested signal store

The key data structure is `Signal<Map<id, Signal<T>>>`. The outer signal tracks collection membership (adds/removes). Each inner signal tracks one item's fields. This means updating one todo's `done` field only re-renders that todo, not the whole list.

```typescript
import { signal, batch, effect } from "../lib/signals";
import type { Signal } from "../lib/signals";

interface Todo { id: string; title: string; done: boolean }

export function connectTodos(ws: WebSocket) {
  const todos = signal(new Map<string, Signal<Todo>>());

  function onMessage(e: MessageEvent) {
    const msg = JSON.parse(e.data);
    if (msg.resource !== "todos") return;

    batch(() => {
      if (msg.action === "create") {
        todos.update(m => new Map(m).set(msg.item.id, signal(msg.item)));
      }
      if (msg.action === "update") {
        const s = todos.peek().get(msg.id);
        if (s) s.update(todo => ({ ...todo, ...msg.fields }));
      }
      if (msg.action === "delete") {
        todos.update(m => { const n = new Map(m); n.delete(msg.id); return n; });
      }
    });
  }

  // Load initial state, then subscribe
  const items = await loadTodos();
  batch(() => {
    const m = new Map<string, Signal<Todo>>();
    for (const t of items) m.set(t.id, signal(t));
    todos.set(m);
  });

  ws.send(JSON.stringify({ action: "opendoc", resource: "todos" }));
  ws.addEventListener("message", onMessage);

  const dispose = () => {
    ws.removeEventListener("message", onMessage);
    ws.send(JSON.stringify({ action: "closedoc", resource: "todos" }));
  };

  return { todos, dispose };
}
```

### Client: rendering with effects

```typescript
function todoListView(root: HTMLElement, ws: WebSocket): Dispose {
  const { todos, dispose } = connectTodos(ws);
  const list = root.querySelector("ul")!;

  // Outer effect: re-runs when items are added/removed
  const disposeOuter = effect(() => {
    list.innerHTML = "";
    for (const [id, todoSignal] of todos.get()) {
      const li = document.createElement("li");
      list.appendChild(li);
      // Inner effect: re-runs when this item's fields change
      effect(() => {
        const t = todoSignal.get();
        li.textContent = `${t.done ? "✓" : "○"} ${t.title}`;
      });
    }
  });

  return () => { disposeOuter(); dispose(); };
}
```

### When to use

- Per-resource live lists (the demo app's todos, notes, checklists)
- Apps where each resource is independent
- Large datasets — only deltas travel the wire

---

## Pattern 2: Full Document Push

An alternative for apps where multiple resources form one logical document. The server assembles a complete state snapshot and pushes it on every change. Views read from a single signal.

### Flow

```
 Client                        Server
 ──────                        ──────
 PUT /api/things/:id   ──────▶ store.write()
                                   │
                              server.publish(topic)
                                   │
                              pushAllDocs()
                                   │ assemble full state
                                   │ from all tables
                                   ▼
 doc.set(fullDoc)          ◀── { type: "doc", doc: {...} }
   │
   ▼
 effect(() => doc.get())
 → all views re-render
```

### Document shapes per role

Different roles see different projections of the same data.

```typescript
interface AdminDoc {
  role: "admin";
  users: User[];
  orders: Order[];
  products: Product[];
}

interface CustomerDoc {
  role: "customer";
  user: { id: string; name: string; email: string };
  orders: Order[];        // filtered to this user
  products: Product[];    // full catalog
}
```

### Server: assemble and push

```typescript
async function computeAdminDoc(): Promise<AdminDoc> {
  const db = inject<DatabaseInstance>("db");
  return {
    role: "admin",
    users: await db.sqliteStore<User>("users").read(),
    orders: await db.sqliteStore<Order>("orders").read(),
    products: await db.sqliteStore<Product>("products").read(),
  };
}

async function computeCustomerDoc(userId: string): Promise<CustomerDoc> {
  // ...read from stores, filter by userId...
}

async function pushAllDocs() {
  const server = tryInject<any>("server");
  if (!server) return;

  server.publish("admin",
    JSON.stringify({ type: "doc", doc: await computeAdminDoc() }));

  for (const userId of connectedCustomers.keys()) {
    server.publish(`customer:${userId}`,
      JSON.stringify({ type: "doc", doc: await computeCustomerDoc(userId) }));
  }
}
```

### Server: WebSocket with role-based topics

```typescript
const connectedCustomers = new Map<string, number>(); // userId → refcount

websocket: {
  open(ws) {
    const { userId, role } = ws.data;
    if (role === "admin") {
      ws.subscribe("admin");
    } else {
      ws.subscribe(`customer:${userId}`);
      connectedCustomers.set(userId, (connectedCustomers.get(userId) ?? 0) + 1);
    }
  },
  close(ws) {
    const { userId, role } = ws.data;
    if (role !== "admin") {
      const count = (connectedCustomers.get(userId) ?? 1) - 1;
      if (count <= 0) connectedCustomers.delete(userId);
      else connectedCustomers.set(userId, count);
    }
  },
}
```

### Client: single doc signal

```typescript
// lib/doc.ts
export const doc = signal<AdminDoc | CustomerDoc | null>(null);

export async function fetchDoc() {
  const res = await fetch("/api/doc");
  if (!res.ok) return null;
  const d = await res.json();
  doc.set(d);
  return d;
}

// app.ts — WebSocket listener
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "doc") doc.set(msg.doc);
});
```

### Client: views read from doc

```typescript
function adminProductView(root: HTMLElement): Dispose {
  const list = root.querySelector("#list")!;
  const dispose = effect(() => {
    const d = doc.get();
    if (!d || d.role !== "admin") return;
    list.innerHTML = d.products
      .map(p => `<li>${esc(p.name)} — $${p.price}</li>`)
      .join("");
  });
  return dispose;
}
```

### When to use

- Multi-role apps where different users see different projections
- Small-to-medium datasets where full pushes are cheap

### Tradeoffs vs granular

Both patterns are consistent — each event (whether a delta or a full snapshot) is applied atomically to the signal tree in one `batch()`. The difference is scope, not consistency.

| | Granular events | Full doc push |
|---|---|---|
| Wire payload | Small delta | Full snapshot |
| Client complexity | Signal map per resource | One signal, simple |
| Scope per event | One resource | All resources in one message |
| Server cost per write | O(1) publish | O(roles × tables) to assemble |
| Best for | Independent resource lists | Multi-resource views, role-based projections |
