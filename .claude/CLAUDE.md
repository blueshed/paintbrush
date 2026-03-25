# Paintbrush

Explicit routes and resources for Bun, powered by [@blueshed/railroad](https://github.com/blueshed/railroad) for signals, JSX, routing, and dependency injection.

## Commands

- `bun dev` — run the app (hot reload)
- `bun run sample` — open the CSS style guide (`/sample` route)
- `bunx tsc --noEmit` — type-check
- `/add-resource` — scaffold a new resource (server + client + view)

## Project layout

```
server.ts              — Bun.serve(): explicit routes, WebSocket, loggedRequest
app.tsx                — client: provide/inject, hash router, JSX components
index.html             — HTML shell (Bun auto-bundles app.tsx)
styles.css             — CSS variables, components, sidebar/dock, responsive
resources/{name}/      — one subfolder per resource
  {name}-api.ts        — server handlers (plain functions)
  {name}.ts            — client store (types, signals, fetch, WS)
  {name}-view.tsx      — JSX functional component
resources/sample.html  — CSS style guide with interactive examples
resources/sample.ts    — sample page script (feather-icons, interactivity)
lib/                   — app-specific utilities
  shared.ts            — provide/inject, tryInject, connectResource, app keys
  reconnecting-ws.ts   — auto-reconnecting WebSocket
  toast.ts             — toast notification (notify/alert)
```

## Conventions

- **Railroad for primitives**: signals, effects, JSX, routes, provide/inject, logger all come from `@blueshed/railroad`
- **Explicit wiring**: routes map to handler functions in `server.ts`, wrapped with `loggedRequest`
- **Resource = folder**: each resource is `resources/{name}/` with three files
- **Server handlers**: plain `(req: Request) => Response` functions. Use `tryInject(SERVER)?.publish()` for WS notify after mutations. Logging is in `server.ts`, not in handlers
- **Client store**: signals + fetch wrappers + optional WS via `connectResource()` helper
- **JSX views**: functional components returning JSX nodes. Reactive via signals, `when()`, `list()`, `text()`. Cleanup is automatic via railroad's dispose scopes
- **Typed keys**: provide/inject uses railroad's typed `key()` symbols, defined in `lib/shared.ts` (`WS`, `SERVER`)
- **TSX config**: `tsconfig.json` sets `jsxImportSource: "@blueshed/railroad"` — no JSX imports needed in .tsx files
- **CSS**: variables in `:root`, `.nav-list` for bordered nav links, `.sidebar` (desktop) and `.dock` (mobile) via `pointer` media queries
- **Icons**: feather-icons via `data-feather` attributes + `feather.replace()`
- **WebSocket protocol**: client sends `opendoc`/`closedoc` with resource topic. Server whitelists topics in a `Set`
