<p align="center"><img src="./logo.png" alt="Logo" width="120"></p>

# Paintbrush

A starter for building web apps with [Bun](https://bun.sh). Explicit routes, reactive signals, and web components — no build step, no framework dependencies.

## Quick start

Requires [Bun](https://bun.sh) 1.3.10+.

```sh
bun create blueshed/paintbrush myapp
cd myapp
bun dev
```

Open `http://localhost:3000`. You get a working app with a single editable message, WebSocket live sync, and a reactive UI.

## What's in the box

```
server.ts          — Bun.serve() with explicit routes and WebSocket handler
app.ts             — client entry: hash router, provide/inject, toast
index.html         — HTML shell (Bun auto-bundles the TypeScript)
styles.css         — minimal CSS with variables and touch targets
resources/message/ — starter resource (server + client + view)
lib/               — shared utilities (signals, router, WebSocket, toast)
```

Each resource is a folder with three files:

| File | Role |
|------|------|
| `{name}-api.ts` | Server handlers — plain functions that return `Response` |
| `{name}.ts` | Client store — types, signals, fetch wrappers, WebSocket subscription |
| `{name}-view.ts` | Web component — shadow DOM, reactive rendering via `effect()` |

## Adding resources

Using [Claude Code](https://claude.com/claude-code)? Type `/add-resource` to scaffold a new resource with all files and wiring.

Manually: create a folder under `resources/`, add the three files following the message pattern, then wire the routes in `server.ts` and `app.ts`.

## How it works

**Server:** Routes map directly to handler functions. No decorators, no metadata, no magic. WebSocket pub/sub notifies clients after mutations.

**Client:** Signals provide lightweight reactivity. `effect()` re-renders when dependencies change. Web components use shadow DOM with `adoptedStyleSheets` to inherit global CSS.

**WebSocket:** One shared connection, multiplexed with `opendoc`/`closedoc` messages. The server whitelists topics in a `Set`.

## CSS

All colours are CSS custom properties in `:root`. Touch targets scale up on touch devices via `@media (pointer: coarse)`. Run `bun run sample` to see the living style guide.

## Design decisions

- **No build step.** Bun bundles TypeScript from `index.html` automatically.
- **No virtual DOM.** Signals drive targeted updates. Web components isolate scope.
- **No framework dependency.** The signal system is ~180 lines. The router is ~120 lines.
- **REST is the write path.** WebSocket is notification-only. Clients write via fetch, receive updates via pub/sub.
- **Explicit over implicit.** Every route and handler is visible in the code. An AI (or a human) can read `server.ts` and know exactly what the app does.

## Built with Claude

This codebase was written with [Claude Code](https://claude.com/claude-code) (Anthropic's Claude Opus). From the signal system and hash router to the resource scaffolding, WebSocket protocol, and deployment config — Claude has been an outstanding collaborator: fast, careful, and genuinely good at thinking through trade-offs before writing code.

## License

MIT
