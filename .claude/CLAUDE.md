# Paintbrush

Routes and resources for Bun, powered by [@blueshed/railroad](https://github.com/blueshed/railroad) for signals, JSX, routing, DI, and delta-doc for real-time document sync over WebSocket.

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
  {name}-view.tsx      — JSX view using delta-doc
resources/sample.html  — CSS style guide with interactive examples
resources/sample.ts    — sample page script (feather-icons, interactivity)
resources/toast.ts     — toast notification (notify/alert)
```

## Conventions

- **Railroad for primitives**: signals, effects, JSX, routes, logger all come from `@blueshed/railroad`
- **Delta-server** (`@blueshed/railroad/delta-server`): WebSocket infrastructure + document/method registration. `createWs()` for action routing, pub/sub via `ws.publish(channel, data)`, targeted messaging via `ws.sendTo(clientId, data)`, raw messages via `ws.on("_raw", handler)`. Each connection gets a `clientId` (from `?clientId=` query param or auto-generated UUID). `publishToSelf` is enabled. `registerDoc(ws, name, opts)` returns `{ getDoc, setDoc, persist, applyAndBroadcast }` for server-side access. `registerMethod(ws, name, handler)` for stateless RPC
- **Delta-client** (`@blueshed/railroad/delta-client`): reactive document sync for the browser. `connectWs("/ws", { clientId })` returns a WS client with a `connected` signal. `openDoc<T>(name)` returns `{ data, dataVersion, ready, send }`. `call<T>(method)` for stateless RPC. Provide the WS via `provide(WS, connectWs(...))`
- **Shared types**: each resource has `{name}-api.ts` with types imported by both server and client (Bun bundles for client, imports directly for server)
- **Resource = type + view**: `resources/{name}/{name}-api.ts` (shared type) + `resources/{name}/{name}-view.tsx` (JSX view)
- **Server wiring**: `registerDoc<T>(ws, name, opts)` for persisted docs, `registerMethod(ws, name, handler)` for stateless calls
- **Client API**: `openDoc<T>(name)` returns `{ data, dataVersion, ready, send }` for docs; `call<T>(method)` for methods. `dataVersion` is a signal that increments on every update (initial load + deltas). `ready` resolves after the initial fetch. `send()` waits for server broadcast (no optimistic updates — `publishToSelf` delivers the confirmation)
- **Delta ops**: mutations use JSON Pointer paths with three ops: `replace`, `add`, `remove` — multiple ops in one `send()` are atomic
- **JSX views**: functional components returning JSX nodes. Reactive via signals, `when()`, `list()`. Cleanup is automatic via railroad's dispose scopes
- **TSX config**: `tsconfig.json` sets `jsxImportSource: "@blueshed/railroad"` — no JSX imports needed in .tsx files
- **CSS**: variables in `:root`, `.sidebar` (desktop) and `.dock` (mobile) via `pointer` media queries
- **Icons**: feather-icons via `data-feather` attributes + `feather.replace()`
- **Toast**: import and call directly — `import { toast } from "../toast"`
