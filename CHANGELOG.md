# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Paintbrush is again what it was for: a starter that grows with the site. It now follows the
Bun website conventions (a small core, parts added when needed, tests at 100%), so 0.3.0 moves
nearly everything.

### Breaking (for apps started from 0.2.x)

- **delta is a part, not the core.** The starter is routes and resources over plain JSON:
  `GET`/`PUT /api/message` and `GET /api/status`. `/ws`, `registerDoc`, `registerMethod` and
  `call("status")` are gone, and with them the imports of `@blueshed/railroad/delta-client` and
  `delta-server`, which railroad removed in 0.7. Live documents come back as the CLAUDE.md part
  "Live documents (delta)", on `@blueshed/delta`.
- **Everything is under `src/`.** `server.ts` is `src/server.ts` and exports `startServer()`;
  `src/main.ts` is the entry point, so `dev` is `bun --hot src/main.ts`. Resources are in
  `src/resources/`.
- **`GET /api/status` no longer says where the data is.** It answers `persistent`, `uptime` and
  `bun`; it used to send the server's absolute data path to any client.
- **The Dockerfile, `@railway/cli`, `feather-icons` and the `/sample` style guide page are gone.**
  The deploy is `.railway/railway.ts` (Railway's IaC) with `bun run build`; `DESIGN.md` and
  `styles.css` stay as the design system.

### Changed

- railroad is `^0.15.1` (was `^0.6.1`); Bun is 1.4 or later; TypeScript 7.
- `CLAUDE.md` is the Bun website conventions with railroad, resources and Railway: Start small,
  Do not use, the Core, the WebView rules, and the parts. It replaces `.claude/CLAUDE.md`, and
  "Adding a resource" replaces the `/add-resource` skill, whose references pointed at files that
  no longer existed.

### Added

- A pid file and `bun run stop`, so a server started in the background can be stopped.
- Tests, held at 100% coverage: every route and method with `fetch`, the page and what it does in
  a real browser (`Bun.WebView`), the entry point and pid file by spawning them, and the
  production build. `bun run typecheck` checks the app, the tests, `create/` and `railway.ts`.
- The deploy in the box: `bun run build` and `serve:dist`, `/health`, and `.railway/railway.ts`
  with a volume for the data.
- `create/setup.ts`, the template's `bun create` postinstall: a fresh `todo.jsonl` and
  `CHANGELOG.md`, the app's name, and railroad's skills in `.claude/skills`.
- `todo.jsonl`, the ledger of open work.

### Fixed

From the 24 Sep review of 0.2.4:

- The message view showed an empty box when you came back to `/`, because its effect ran before
  the textarea existed.
- A save from another window overwrote what you were typing.
- "Saved" appeared before the write had been answered, so a failed write still said it.
- A failed status call left the status area blank.
- `og:image` was a relative URL, which link-preview crawlers ignore; the tags are gone.
