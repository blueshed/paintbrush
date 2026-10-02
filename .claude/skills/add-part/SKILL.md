---
name: add-part
description: "Add a part to this app: static files, a WebSocket, live documents with delta, SQLite, passwords, or the rest of the design system (navigation, lists, modals). Use when the user asks for one of these, or when another change you are making needs one. Do not add a part on a guess."
---

# Add a part

The starter is small on purpose: routes and resources over JSON, railroad for the page, Railway for the deploy. A part is something it does not have until it is asked for. Each part is one file in `${CLAUDE_SKILL_DIR}/parts/`, with its code and the tests that come with it.

| Part | Add it when | File |
|---|---|---|
| Static files | the site serves files the page links to or fetches but does not embed: downloads, data loaded at runtime; or one file at a route of its own | `static-files.md` |
| WebSocket | the page needs live updates from the server and they are not documents | `websocket.md` |
| Live documents (delta) | several people read and write the same data and each should see the others' changes as they happen | `live-documents.md` |
| SQLite | the site stores records that must survive a restart and one JSON file no longer fits | `sqlite.md` |
| Passwords | users sign in | `passwords.md` |
| Design system | the app needs a menu, a list of records, a detail page with a way back, a dialog, or the sidebar and dock | `design-system.md` |

Images, icons and a second stylesheet need no part: put them in `src/` next to the HTML and reference them with relative paths in `index.html` (`<link rel="icon" href="./favicon.svg" />`, `<img src="./photo.png" />`). Bun bundles and hashes them. Do not use `/static/...` paths for these: the bundler resolves every `<link>`, `<img>`, `<video>` and `<audio>` path at bundle time, and an absolute path it cannot find breaks the page.

## How to add one

1. Read the part's file, and `CLAUDE.md` for the rules it relies on (Start small, the tests, 100% coverage).
2. Add its code and its tests together. `bun test` fails below 100%, so a part without its tests does not land.
3. Add the part's `.gitignore` lines, if it has any.
4. Run `bun run typecheck` and `bun test`.
5. Record it: a line under `## [Unreleased]` in `CHANGELOG.md`, and close any item in `todo.jsonl` that asked for it.

Where two parts need each other (passwords need a backend that takes `auth`, so SQLite or Postgres first), add the one it depends on first.

The code in these parts was run on Bun 1.4.2 with railroad 0.15.1 and delta 0.11.0. If one of those has moved, check the part against the package's own skill (`railroad`, `delta-doc`) before trusting it.
