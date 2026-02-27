Add a new resource to the Paintbrush app. Refer to `.claude/CLAUDE.md` for architecture, decorator API, and key patterns (event delegation, cancelled guards, esc(), signal stores, WebSocket protocol).

Ask the user for:

1. **Resource name** (singular, e.g. "project", "task", "bookmark")
2. **Fields** — name, type, and options (required? readonly? default value?)
3. **Real-time?** — should it have WebSocket live updates (`notify`) or be REST-only?

Then create all files using the patterns below. Use the resource name throughout (lowercase for files/paths, PascalCase for the class).

## Files to create

### 1. `resources/{name}s-api.ts` — Resource class

```ts
import { Resource, Field } from "../lib/decorators";
import { jsonFile } from "../lib/stores";

@Resource("/api/{name}s", jsonFile(import.meta.dir + "/{name}s.json"), { notify: "{name}s" })
// Omit the third argument if REST-only (no real-time)
export class {Name} {
  @Field({ required: true }) accessor title: string = "";
  // Add fields based on user input
  @Field({ readonly: true }) accessor createdAt: string = "";
  id: string = "";
}
```

### 2. `resources/{name}s.ts` — Client wrappers

Follow the pattern in `resources/notes.ts` for REST-only, or `resources/todos.ts` for real-time. Include:
- `load{Name}s()` — GET list
- `load{Name}(id)` — GET by id
- `create{Name}(data)` — POST
- `save{Name}(data)` — PUT
- `delete{Name}(id)` — DELETE
- If real-time: `connect{Name}s(ws)` — returns `{ {name}s: Signal<Map<string, Signal<{Name}>>>, dispose }`

### 3. `resources/{name}s-views.ts` — Views

Follow the pattern in `resources/notes-views.ts` for REST-only, or `resources/todos-views.ts` for real-time. Include:
- `{name}ListView(root, ws?)` — list view with create button
- `{name}DetailView(root, id)` — edit form with autosave and delete
- Cancelled guards on async views
- Event delegation on lists
- `esc()` on all user content and attribute values

### 4. `resources/{name}s.json` — Empty data file

```json
[]
```

## Files to modify

### 5. `server.ts` — Register the resource

```ts
import { {Name} } from "./resources/{name}s-api";
// Add to buildRoutes:
...buildRoutes(Note, Todo, {Name}, Stats),
```

### 6. `app.ts` — Add client routes

```ts
import { {name}ListView, {name}DetailView } from "./resources/{name}s-views";
// Add to routes():
"/{name}s": () => {name}ListView(app, ws),  // omit ws if REST-only
"/{name}s/:id": ({ id }) => {name}DetailView(app, id),
```

Add a nav item in `homeView`:
```ts
<li class="nav-item" id="go-{name}s">{Name}s</li>
// and the click handler:
root.querySelector("#go-{name}s")!.addEventListener("click", () => navigate("/{name}s"));
```

## After creating

1. Run `bunx tsc --noEmit` — must be clean
2. Run `bun test` — existing tests must pass
3. Verify in browser: list view, create, edit, delete
4. If real-time: verify with `curl` that changes appear live
