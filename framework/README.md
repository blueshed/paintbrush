# Framework

The original decorator-based Paintbrush framework. Kept as reference — the root project uses explicit routes and handlers instead.

## Contents

| Directory | What's in it |
|-----------|-------------|
| `lib/` | Decorator framework: `@Resource`, `@Field`, `@Auth`, `@Controller`, `buildRoutes()`, stores, sessions, tokens, TOTP, signals, utilities, and tests |
| `demo/` | Full demo app — notes, todos, checklists, admin, SQLite, real-time sync |
| `zero/` | Minimal starter — single editable message, JSON file storage |
| `docs/` | Reference docs: deployment, auth, CQRS patterns |
| `sample.html` | Living CSS style guide (`bun run sample` from project root) |

## Running the demos

```sh
# from project root
bun --hot framework/demo/server.ts    # full demo app
bun --hot framework/zero/server.ts    # minimal starter
bun run sample                        # CSS style guide
```

## How the decorator framework works

Define a class with `@Resource` and `@Field`, and `buildRoutes()` generates five REST endpoints with validation, defaults, and optional WebSocket broadcasts:

```ts
@Resource("/api/todos", jsonFile("./todos.json"), { notify: "todos" })
class Todo {
  @Field({ required: true }) accessor title: string = "";
  @Field() accessor status: string = "pending";
  @Field({ readonly: true }) accessor createdAt: string = "";
  id: string = "";
}
```

Three pluggable stores: `jsonFile()`, `sqliteStore()`, `memoryStore()`.

## Why the root project doesn't use it

The root project is designed for AI-generated code. Explicit wiring (plain handler functions mapped in `server.ts`) is easier for an LLM to read, extend, and debug than decorator metadata resolved at runtime via `buildRoutes()`.

The framework is still useful for humans who know the conventions and want to move fast.
