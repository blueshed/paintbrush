# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Paintbrush is again what it was for: routes and resources, with railroad for the page and
Railway for the deploy, that a resource can evolve from. It follows the Bun website conventions
(a small core, tests at 100%), so 0.3.0 moves nearly everything.

### Breaking (for apps started from 0.2.x)

- **delta is no longer in the box.** A resource starts as HTTP routes: `GET`/`PUT /api/message`
  and `GET /api/status`, each with a fetching store. `/ws`, `registerDoc`, `registerMethod` and
  `call("status")` are gone, with the imports of `@blueshed/railroad/delta-client` and
  `delta-server`, which railroad removed in 0.7. A resource evolves to a WebSocket and then to a
  delta document: the `evolve` skill has each step, with its tests.
- **Everything is under `src/`.** `src/server.ts` lists the routes and exports `startServer()`,
  `src/main.ts` is the entry point (`dev` is `bun --hot src/main.ts`), and resources are in
  `src/resources/`.
- **`GET /api/status` no longer says where the data is.** It answers `persistent`, `uptime` and
  `bun`; it used to send the server's absolute data path to any client.
- **The default message is "Hello", the heading is "Message", and there is no favicon.** The
  template's name and logo no longer end up in an app.
- **Removed:** the Dockerfile, `@railway/cli`, `feather-icons`, the `/sample` style guide page
  and the `/add-resource` skill (its references pointed at files that no longer existed).

### Changed

- railroad is `^0.15.1` (was `^0.6.1`); Bun is 1.4 or later; TypeScript 7.
- `CLAUDE.md` is written in routes and resources, and short. The rules sit next to what they
  describe: the design's at the top of `styles.css` (108 lines, from 268: only what the page
  uses), the browser-test rules at the top of the test file, the Railway rules at the top of
  `railway.ts`.

### Added

- A pid file and `bun run stop`, so a server started in the background can be stopped.
- Tests, held at 100% coverage: every route and method with `fetch`, the page and what it does
  in a real browser (`Bun.WebView`), the entry point and pid file by spawning them, the
  production build, and `create/setup.ts`. `bun run typecheck` checks the app, the tests,
  `create/` and `railway.ts`.
- The deploy in the box: `bun run build` and `serve:dist`, `/health`, and `.railway/railway.ts`
  with a volume for the data.
- The Claude Code web sandbox, whose Bun is older than this app needs and which has no browser:
  a SessionStart hook (railroad's, adapted) installs the latest Bun and a headless Chromium
  there, and does nothing anywhere else. A CI workflow runs the typecheck and the tests on
  GitHub, with Chrome.
- `create/setup.ts`, the template's `bun create` postinstall: a fresh `todo.jsonl` and
  `CHANGELOG.md`, the app's name, and railroad's skill in `.claude/skills` (not its `bun-route`
  skill, which tells a session to run `bun init` and use Playwright). It refuses to run in a
  clone of the template, and ends by leaving the new repository committed: bun create's own git
  step runs while the script does and can fail on a file the script has just deleted (found
  when a new app had no first commit). Run from GitHub on `main` after the merge, twice: both
  times bun create's git step failed that way and setup left one commit and a clean tree, and
  the new app's 17 tests pass at 100%.
- `todo.jsonl`, the ledger of open work, and a `.claude/launch.json` for the dev server.

### Fixed

From the 24 Sep review of 0.2.4:

- The message view showed an empty box when you came back to `/`, because its effect ran before
  the textarea existed.
- A save from another window overwrote what you were typing.
- "Saved" appeared before the write had been answered, so a failed write still said it.
- A failed status call left the status area blank.
- `og:image` was a relative URL, which link-preview crawlers ignore; the tags are gone.
