# Paintbrush

Routes and resources for Bun, powered by [@blueshed/railroad](https://github.com/blueshed/railroad) for signals, JSX, routing, and DI, with delta-ws for real-time document sync over WebSocket.

## Commands

- `bun dev` — run the app (hot reload)
- `bun run sample` — open the CSS style guide (`/sample` route)
- `bunx tsc --noEmit` — type-check
- `/add-resource` — scaffold a new resource

## Project layout

```
server.ts              — Bun.serve(): hub (docs + methods), routes, WebSocket
app.tsx                — client: hash router, JSX components
index.html             — HTML shell (Bun auto-bundles app.tsx)
styles.css             — CSS variables, components, sidebar/dock, responsive
resources/{name}/      — one subfolder per resource
  {name}-api.ts        — shared type (imported by both server and client)
  {name}-view.tsx      — JSX view using delta-ws
resources/sample.html  — CSS style guide with interactive examples
resources/sample.ts    — sample page script (feather-icons, interactivity)
lib/                   — app-specific utilities
  paintbrush-ws.ts     — shared WebSocket protocol: action routing, pub/sub, request/response
  delta-doc.ts         — document sync over paintbrush-ws: registerDoc, registerMethod, connect/open/call
  reconnecting-ws.ts   — auto-reconnecting WebSocket (used by delta-ws)
  toast.ts             — toast notification (notify/alert)
```

## Conventions

- **Railroad for primitives**: signals, effects, JSX, routes, logger all come from `@blueshed/railroad`
- **Paintbrush-ws**: shared WebSocket protocol layer — action routing via `ws.on(action, handler)`, Bun pub/sub via `ws.publish(channel, data)`, targeted messaging via `ws.sendTo(clientId, data)`, raw message handling via `ws.on("_raw", handler)`. Each connection gets a `clientId` (from `?clientId=` query param or auto-generated UUID). `publishToSelf` is enabled — the sender receives their own broadcasts
- **Delta-doc for sync**: document sync over paintbrush-ws — `registerDoc(ws, name, opts)` for persisted docs (returns `{ getDoc, setDoc, persist, applyAndBroadcast }` for server-side access), `registerMethod(ws, name, handler)` for stateless RPC, `connect("/ws")` on the client
- **Shared types**: each resource has `{name}-api.ts` with types imported by both server and client (Bun bundles for client, imports directly for server)
- **Resource = type + view**: `resources/{name}/{name}-api.ts` (shared type) + `resources/{name}/{name}-view.tsx` (JSX view)
- **Server wiring**: `hub.doc<T>(name, opts)` for persisted docs, `hub.method(name, handler)` for stateless calls
- **Client API**: `hub.open<T>(name)` returns `{ data, dataVersion, ready, send }` for docs; `hub.call<T>(method)` for methods. `dataVersion` is a signal that increments on every update (initial load + deltas). `ready` resolves after the initial fetch. `send()` waits for server broadcast (no optimistic updates — `publishToSelf` delivers the confirmation)
- **Client connection**: `connectWs("/ws", { clientId })` accepts an optional stable client identity. Returns a `connected` signal for reactive connection state
- **Delta ops**: mutations use JSON Pointer paths with three ops: `replace`, `add`, `remove` — multiple ops in one `send()` are atomic
- **JSX views**: functional components returning JSX nodes. Reactive via signals, `when()`, `list()`. Cleanup is automatic via railroad's dispose scopes
- **TSX config**: `tsconfig.json` sets `jsxImportSource: "@blueshed/railroad"` — no JSX imports needed in .tsx files
- **CSS**: variables in `:root`, `.sidebar` (desktop) and `.dock` (mobile) via `pointer` media queries
- **Icons**: feather-icons via `data-feather` attributes + `feather.replace()`
- **Toast**: import and call directly — `import { toast } from "@lib/toast"`
