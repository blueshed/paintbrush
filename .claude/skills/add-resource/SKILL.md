---
name: add-resource
description: Scaffold a new resource with delta-doc server store and JSX view
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
- [reference/patterns.md](reference/patterns.md) — delta-doc server store, client store, delta ops, wiring
- [reference/views.md](reference/views.md) — JSX functional components, singleton and collection views

**Living reference** (the actual working code):
- `resources/message/message-view.tsx` — singleton view with inline client store
- `lib/delta-doc.ts` — server and client store factories, delta ops
- `server.ts` — where to wire server stores and spread routes
- `app.tsx` — where to wire client routes and view imports
- `resources/sample.html` — CSS class reference for UI (`/sample` route)

## Create files

Each resource is a subfolder under `resources/`:

1. `resources/{name}/{name}-view.tsx` — JSX view with inline client store (singleton: one export; collection: `{Name}List` + `{Name}Detail`)

## Wire files

2. `server.ts` — create delta-doc server store, spread its routes, call `setServer()` after `Bun.serve()`
3. `app.tsx` — import view component(s), add client routes

## Verify

1. `bunx tsc --noEmit` — must be clean
2. Verify in browser: view loads, edits persist, changes sync across tabs
