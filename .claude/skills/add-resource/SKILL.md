---
name: add-resource
description: Scaffold a new resource with shared type, delta-doc doc, and JSX view
disable-model-invocation: true
argument-hint: [resource-name]
---

# Add Resource

Scaffold a new resource for the Paintbrush app using delta-doc.

## Gather inputs

Ask the user for (skip if provided as arguments):

1. **Resource name** — singular (e.g. "note", "task", "bookmark")
2. **Fields** — name and type for each field
3. **Singleton or collection?** — single document or list of items with CRUD

Use `{name}` for lowercase singular, `{Name}` for PascalCase, `{names}` for lowercase plural.

## Read reference files first

Before generating any code, read these files to learn the exact patterns:

**In this skill folder** (adaptation guides):
- [reference/patterns.md](reference/patterns.md) — delta-doc server/client, delta ops, wiring
- [reference/views.md](reference/views.md) — JSX functional components, singleton and collection views

**Living reference** (the actual working code):
- `resources/message/message-api.ts` — shared type (singleton)
- `resources/message/message-view.tsx` — singleton view with delta-doc
- `resources/graph/graph-api.ts` — shared types (multi-entity)
- `resources/graph/graph.tsx` — complex view with list() and atomic ops
- `lib/delta-doc.ts` — hub (server) + connect/open/call (client)
- `server.ts` — where to register docs and methods
- `app.tsx` — where to wire client routes and view imports
- `resources/sample.html` — CSS class reference for UI (`/sample` route)

## Create files

Each resource is a subfolder under `resources/`:

1. `resources/{name}/{name}-api.ts` — shared type (imported by both server and client)
2. `resources/{name}/{name}-view.tsx` — JSX view using `hub.open()` for docs

## Wire files

3. `server.ts` — register doc with `hub.doc<T>(name, opts)`, import shared type
4. `app.tsx` — import view component(s), add client routes

## Verify

1. `bunx tsc --noEmit` — must be clean
2. Verify in browser: view loads, edits persist, changes sync across tabs
