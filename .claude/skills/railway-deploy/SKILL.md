---
name: railway-deploy
description: "Deploy this app to Railway, or change how it deploys: the production build, the healthcheck, .railway/railway.ts (Railway's infrastructure as code), the data volume, and the plan-then-apply workflow with its safety rules. Use when the user wants the app online, or when you change anything under .railway/ or the build scripts."
---

# Deploying to Railway

The deploy is in the box: `bun run build`, `/health`, and `.railway/railway.ts`. Nothing here is applied without the user.

## The build

`bun run build` bundles the server and pre-bundles the HTML imports, so production does no runtime bundling. `serve:dist` runs the result; a test builds it, runs it, and checks the page has no HMR client.

- `build` needs `--production`, not just `--minify`: it inlines `NODE_ENV=production`. Without it the bundler folds `NODE_ENV !== "production"` to `true` and the built server runs with HMR on.
- `serve:dist` runs from inside `dist/` because the built server finds its bundled JS and CSS relative to the working directory. Everything else on disk (`data/`, `public/`, `.server.pid`) is found from `import.meta.dir`, never the working directory: `src/` and `dist/` both sit one level below the project root.
- `package.json` has `"packageManager": "bun@1.4.2"`. Railway's builder reads the Bun version from it, and the deployed Bun must be 1.4 or later.
- Railway sets `PORT`; `startServer()` reads it. Do not hard-code a port.

## .railway/railway.ts

Railway's Infrastructure as Code SDK (the `railway` devDependency) describes the project in TypeScript, and the Railway CLI, 5.42.1 or newer (the IaC engine ships in the CLI), plans and applies the difference against the live environment. There is no state file. `tsconfig.json` names the file in `include`, so `bun run typecheck` checks it: naming the folder is not enough, and the default skips dot-folders.

- Set `OWNER/REPO` in `github(...)` before the first plan.
- The service gets a volume at `/data` (the key in `volumeMounts` is the mount path) and `DATA_PATH=/data`, so `message.json` survives deploys. Drop the volume when the data moves to Postgres.
- The file describes the **whole** environment: a resource left out of it is deleted on apply. Add things (a `postgres("db")`, another `volume(...)`) rather than rewriting it.
- Keep one replica. Open sockets, in-memory state and a JSON-file or SQLite database live in one process; more replicas need shared state first.
- Secrets never go in this file. Set them in the Railway dashboard and reference them with `preserve()` (from `railway/iac`): `env: { API_KEY: preserve() }`.

## The workflow

```bash
railway login          # once
railway link           # once: choose project and environment
railway config plan    # show what would change
railway config apply   # apply, after confirmation
```

Always run `railway config plan` and show the user the result. **Never run `railway config apply` without the user's explicit go-ahead**, and never pass `--yes` or `--confirm-destructive` (the second is what lets an agent session delete resources). An apply is rejected if the environment changed since the plan, so plan again rather than forcing it.

`railway.ts` was type-checked and evaluated locally when it was written, but `railway config plan` was not run against it: that needs a linked project. The first plan is the first real check, and whether the volume must also be listed in `resources` is for that plan to say.
