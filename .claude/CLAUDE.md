# Paintbrush

Explicit routes and resources for Bun. Every route, handler, and subscription is visible in the code.

## Commands

- `bun dev` — run the app (hot reload)
- `bun run sample` — open the CSS style guide
- `bunx tsc --noEmit` — type-check
- `/add-resource` — scaffold a new resource (server + client + view)

## Project layout

```
server.ts              — Bun.serve(): explicit routes, WebSocket handler
app.ts                 — client: provide/inject, hash router, view imports
index.html             — HTML shell (Bun auto-bundles app.ts)
styles.css             — CSS variables, components, touch targets
resources/{name}/      — one subfolder per resource
  {name}-api.ts        — server handlers (exported functions)
  {name}.ts            — client store (types, signals, fetch, WS)
  {name}-view.ts       — web component (custom element)
lib/                   — shared utilities
  signals.ts           — Signal, effect, computed, batch
  routes.ts            — hash router: routes(), navigate()
  shared.ts            — provide/inject/tryInject registry
  reconnecting-ws.ts   — auto-reconnecting WebSocket
  toast.ts             — toast notification (notify/alert)
```

## Conventions

- **Explicit wiring**: routes map directly to handler functions in `server.ts`
- **Resource = folder**: each resource is `resources/{name}/` with three files
- **Server handlers**: plain `(req: Request) => Response` functions. Use `tryInject<any>("server")?.publish()` for WebSocket notify after mutations
- **Client store**: signals + fetch wrappers + optional WS subscription. Types shared via `import type`
- **Web components**: shadow DOM with `adoptedStyleSheets` to inherit global CSS. Reactive via `effect()`. Clean up in `disconnectedCallback`
- **Provide/inject**: registry for shared services (ws, toast, server). Separate instances on server vs client
- **CSS variables**: all colors in `:root`. Variables pierce shadow DOM. Touch targets via `@media (pointer: coarse)`
- **WebSocket protocol**: client sends `opendoc`/`closedoc` with resource topic. Server whitelists topics in a `Set`
