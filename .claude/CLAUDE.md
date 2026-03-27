# Paintbrush

Explicit routes and resources for Bun, powered by [@blueshed/railroad](https://github.com/blueshed/railroad) for signals, JSX, routing, and DI, with delta-doc for real-time document sync.

## Commands

- `bun dev` — run the app (hot reload)
- `bun run sample` — open the CSS style guide (`/sample` route)
- `bunx tsc --noEmit` — type-check
- `/add-resource` — scaffold a new resource

## Project layout

```
server.ts              — Bun.serve(): delta-doc stores, routes, WebSocket
app.tsx                — client: hash router, JSX components
index.html             — HTML shell (Bun auto-bundles app.tsx)
styles.css             — CSS variables, components, sidebar/dock, responsive
resources/{name}/      — one subfolder per resource
  {name}-view.tsx      — JSX view with inline delta-doc client store
resources/sample.html  — CSS style guide with interactive examples
resources/sample.ts    — sample page script (feather-icons, interactivity)
lib/                   — app-specific utilities
  delta-doc.ts         — server + client store factories, delta ops, WS sync
  reconnecting-ws.ts   — auto-reconnecting WebSocket (used by delta-doc)
  toast.ts             — toast notification (notify/alert)
```

## Conventions

- **Railroad for primitives**: signals, effects, JSX, routes, logger all come from `@blueshed/railroad`
- **Delta-doc for sync**: `createServerStore` (file + broadcast) and `createClientStore` (signal + WS + fetch) handle persistence and real-time sync
- **Resource = one view file**: each resource is `resources/{name}/{name}-view.tsx` with an inline client store
- **Server wiring**: create delta-doc server stores in `server.ts`, spread their routes, call `setServer()` after `Bun.serve()`
- **Delta ops**: mutations use JSON Patch-like ops (`replace`, `add`, `remove`) via `sendDelta()`
- **JSX views**: functional components returning JSX nodes. Reactive via signals, `when()`, `list()`. Cleanup is automatic via railroad's dispose scopes
- **TSX config**: `tsconfig.json` sets `jsxImportSource: "@blueshed/railroad"` — no JSX imports needed in .tsx files
- **CSS**: variables in `:root`, `.sidebar` (desktop) and `.dock` (mobile) via `pointer` media queries
- **Icons**: feather-icons via `data-feather` attributes + `feather.replace()`
- **Toast**: import and call directly — `import { toast } from "@lib/toast"`
