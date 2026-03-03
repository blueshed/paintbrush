---
name: add-resource
description: Scaffold a new resource with server handlers, client store, and web component view
disable-model-invocation: true
argument-hint: [resource-name]
---

# Add Resource

Scaffold a new resource for the Paintbrush app.

## Gather inputs

Ask the user for (skip if provided as arguments):

1. **Resource name** — singular (e.g. "note", "task", "bookmark")
2. **Fields** — name and type for each field
3. **Real-time?** — WebSocket live updates or REST-only?

Use `{name}` for lowercase singular, `{Name}` for PascalCase, `{names}` for lowercase plural.

## Read reference files first

Before generating any code, read these files to learn the exact patterns:

**In this skill folder** (adaptation guides for collections):
- [reference/patterns.md](reference/patterns.md) — server handlers, client store, WebSocket, and wiring
- [reference/views.md](reference/views.md) — web component structure, list/detail templates, shadow DOM, cleanup

**Living reference** (the actual working code):
- `resources/message/message-api.ts` — server handler pattern
- `resources/message/message.ts` — client store pattern (types, signals, fetch, WebSocket)
- `resources/message/message-view.ts` — web component pattern (shadow DOM, effects, toast)
- `server.ts` — where to wire routes and topics
- `app.ts` — where to wire client routes and view imports
- `framework/sample.html` — CSS class reference for UI

## Create files

Each resource is a subfolder under `resources/`:

1. `resources/{name}/{name}-api.ts` — server handlers
2. `resources/{name}/{name}.ts` — client store
3. `resources/{name}/{name}-view.ts` — web component (or two: `{name}-list` + `{name}-detail`)
4. `resources/{name}/{names}.json` — empty data file `[]`

## Wire files

5. `server.ts` — import handlers, add API routes, add topic to `topics` Set if real-time
6. `app.ts` — import view, add client routes

## Verify

1. `bunx tsc --noEmit` — must be clean
2. Verify in browser: list, create, edit, delete
3. If real-time: two tabs, changes appear live
