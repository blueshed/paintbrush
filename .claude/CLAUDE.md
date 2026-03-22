# Paintbrush

Explicit routes and resources for Bun, powered by [@blueshed/railroad](https://github.com/blueshed/railroad) for signals, JSX, routing, and dependency injection.

## Commands

- `bun dev` — run the app (hot reload)
- `bun run sample` — open the CSS style guide
- `bunx tsc --noEmit` — type-check
- `/add-resource` — scaffold a new resource (server + client + view)

## Project layout

```
server.ts              — Bun.serve(): explicit routes, WebSocket handler
app.tsx                — client: provide/inject, hash router, JSX components
index.html             — HTML shell (Bun auto-bundles app.tsx)
styles.css             — CSS variables, components, touch targets
resources/{name}/      — one subfolder per resource
  {name}-api.ts        — server handlers (exported functions)
  {name}.ts            — client store (types, signals, fetch, WS)
  {name}-view.tsx      — JSX functional component
lib/                   — app-specific utilities
  shared.ts            — re-exports railroad's provide/inject, adds tryInject + app keys
  reconnecting-ws.ts   — auto-reconnecting WebSocket
  toast.ts             — toast notification (notify/alert)
```

## Conventions

- **Railroad for primitives**: signals, effects, JSX, routes, provide/inject, and logger all come from `@blueshed/railroad`
- **Explicit wiring**: routes map directly to handler functions in `server.ts`
- **Resource = folder**: each resource is `resources/{name}/` with three files
- **Server handlers**: plain `(req: Request) => Response` functions. Use `tryInject(SERVER)?.publish()` for WebSocket notify after mutations
- **Client store**: signals + fetch wrappers + optional WS subscription. Types shared via `import type`
- **JSX views**: functional components returning JSX nodes. Reactive via signals, `when()`, `list()`, `text()`. Cleanup is automatic via railroad's dispose scopes
- **Typed keys**: provide/inject uses railroad's typed `key()` symbols, defined in `lib/shared.ts` (`WS`, `TOAST`, `SERVER`)
- **TSX config**: `tsconfig.json` sets `jsxImportSource: "@blueshed/railroad"` — no JSX imports needed in .tsx files
- **CSS variables**: all colors in `:root`. Touch targets via `@media (pointer: coarse)`
- **WebSocket protocol**: client sends `opendoc`/`closedoc` with resource topic. Server whitelists topics in a `Set`
