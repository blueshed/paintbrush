# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Paintbrush is again what it was for: a starter that grows with the site. It follows the Bun
website conventions (a small core, parts added when asked for, tests at 100%), so 0.3.0 moves
nearly everything.

### Breaking (for apps started from 0.2.x)

- **delta is a part, not the core.** The starter is routes and resources over plain JSON:
  `GET`/`PUT /api/message` and `GET /api/status`. `/ws`, `registerDoc`, `registerMethod` and
  `call("status")` are gone, with the imports of `@blueshed/railroad/delta-client` and
  `delta-server`, which railroad removed in 0.7. Live documents come back as the `add-part`
  skill's "Live documents (delta)", on `@blueshed/delta`.
- **Everything is under `src/`, and a resource's files are named for their role.**
  `src/server.ts` exports `startServer()`, `src/main.ts` is the entry point (`dev` is
  `bun --hot src/main.ts`), and a resource is `src/resources/<name>/api.ts`, `store.ts` and
  `view.tsx`. A resource brings its own routes (`...messageRoutes(dataDir)` in `startServer`).
- **`GET /api/status` no longer says where the data is.** It answers `persistent`, `uptime` and
  `bun`; it used to send the server's absolute data path to any client.
- **The default message is "Hello", the heading is "Message", and there is no favicon.** The
  template's name and logo no longer end up in an app.
- **Removed:** the Dockerfile, `@railway/cli`, `feather-icons`, the `/sample` style guide page
  and the `/add-resource` skill (its references pointed at files that no longer existed).

### Changed

- railroad is `^0.15.1` (was `^0.6.1`); Bun is 1.4 or later; TypeScript 7.
- `CLAUDE.md` is short: what is here, what not to use, the rules that hold. What a part, a
  browser test or a deploy needs is in skills that load when it is needed: `add-part`,
  `webview-tests` and `railway-deploy`.
- `styles.css` and `.claude/DESIGN.md` hold only what the page uses (108 lines of CSS, from 268).
  Navigation, lists, modals, the sidebar and the dock moved to the design-system part.
- Two helpers replace the code every resource would have copied: `jsonFile` (server) keeps a
  value in a JSON file, and `resource` (client) is a signal with `load`, `save` and `failed`,
  shaped like a delta document's client handle so a view hardly changes when delta is added.

### Added

- A pid file and `bun run stop`, so a server started in the background can be stopped.
- Tests, held at 100% coverage: every route and method with `fetch`, the page and what it does
  in a real browser (`Bun.WebView`), the entry point and pid file by spawning them, the
  production build, and `create/setup.ts`. `bun run typecheck` checks the app, the tests,
  `create/` and `railway.ts`.
- The deploy in the box: `bun run build` and `serve:dist`, `/health`, and `.railway/railway.ts`
  with a volume for the data.
- The Claude Code web sandbox: a SessionStart hook (railroad's, adapted) provides Bun and a
  headless Chromium there, and does nothing anywhere else.
- A CI workflow: typecheck and `bun test`, with Chrome for the browser tests.
- `create/setup.ts`, the template's `bun create` postinstall: a fresh `todo.jsonl` and
  `CHANGELOG.md`, the app's name, and railroad's skills in `.claude/skills`. It refuses to run
  in a clone of the template.
- `todo.jsonl`, the ledger of open work, and a `.claude/launch.json` for the dev server.

### Fixed

From the 24 Sep review of 0.2.4:

- The message view showed an empty box when you came back to `/`, because its effect ran before
  the textarea existed.
- A save from another window overwrote what you were typing.
- "Saved" appeared before the write had been answered, so a failed write still said it.
- A failed status call left the status area blank.
- `og:image` was a relative URL, which link-preview crawlers ignore; the tags are gone.
