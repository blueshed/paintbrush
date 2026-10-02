---
name: webview-tests
description: "Write or change a browser test for this app with Bun.WebView: the rules to follow exactly, the helpers in tests/site.test.ts, and how the tests run on macOS, in the Claude Code web sandbox and in CI. Use when adding a test that drives the page, or when a browser test hangs or times out."
---

# Browser tests with Bun.WebView

Every route and everything a person sees or clicks has a test. Routes are tested with `fetch`, the page in a real browser with `Bun.WebView`, and entry points by spawning them. All of it is in `tests/site.test.ts`, which holds the helpers:

| Helper | What it does |
|---|---|
| `api(path, init?)` | `fetch` against the test server |
| `open()` | loads the page afresh. Navigating to the URL a view is already at does not reload it, so each visit gets a query of its own, which the routes ignore |
| `waitFor(expr)` | polls a page-side expression until it is truthy; anything rendered after a `fetch` has to be polled for |
| `replaceText(selector, text)` | replaces what is in a field the way typing would: clears it, tells the page, then types |
| `failFetch()` | makes every `fetch` the page makes from now on answer 500, to test what a person sees when the server says no |
| `spawnServer(cmd, env?)` | runs a server process on a random port and resolves once it prints its URL |

The test server starts on a random port with a scratch data folder, and tests run in file order: the first needs a data folder nothing has been saved to.

## The rules (the API is experimental; follow these exactly)

- `evaluate()` takes a **string expression**, not a function: `view.evaluate("document.title")`. For statements, wrap them in an IIFE string: `"(() => { ... })()"`. Results come back as JSON, so return plain data, not DOM nodes. It returns `unknown` unless given a type: `evaluate<string>(...)`.
- `await` every call. Each view allows one `navigate`, one `evaluate`, one `screenshot` and one input action in flight at a time; a second concurrent call throws `ERR_INVALID_STATE` instead of queueing.
- `navigate(url)` resolves on the page's `load` event.
- Click by selector: `view.click("button.primary")` waits until the element is visible, stable and not covered. Prefer it to coordinates.
- `click` does not scroll. An element below the window never becomes visible, so the click waits out its timeout. Scroll it into view first: `` await view.evaluate(`document.querySelector("#send").scrollIntoView({ block: "center" })`) ``.
- To fill a field: `click` it to focus, then `type`. Typing appends: use `replaceText` to replace. `view.press("Enter")` presses a key.
- `view.url` updates after each navigation; `view.title` does not (on macOS WebKit it is empty after every `navigate` but the first). Read the title with `evaluate<string>("document.title")`.
- `view.screenshot()` returns a Blob: `await Bun.write("tests/out/home.png", await view.screenshot())` is useful when a test fails. `tests/out/` is in `.gitignore`.
- One `WebView` per test file, opened in `beforeAll` and closed in `afterAll`. A test that needs a second window opens its own and closes it in a `finally`.

## Where it runs

- **macOS:** the system WebKit, nothing to install.
- **Linux and Windows:** Chrome, Chromium, Edge or Brave, found through `BUN_CHROME_PATH` if Bun cannot find it.
- **Claude Code on the web:** the sandbox has no browser and blocks the browser download hosts, so the SessionStart hook (`.claude/hooks/session-start.sh`) upgrades Bun if it is older than `engines.bun`, installs the dependencies, and stages a headless Chromium from npm with a `--no-sandbox` shim, then sets `BUN_CHROME_PATH`. The hook is railroad's, copied; the reasons are in its comments. It does nothing anywhere else, and a test says so.
- **CI:** `.github/workflows/ci.yml` finds the runner's Chrome and wraps it with `--no-sandbox`, because the runner's AppArmor rules stop Chrome's own sandbox from starting, and the browser tests then hang rather than fail.

A browser test that hangs on Linux is almost always the browser, not the test: check that `BUN_CHROME_PATH` names a launcher that passes `--no-sandbox`.
