// The deploy, as code: Railway's Infrastructure as Code. The Railway CLI (5.42.1 or newer, the
// engine ships in the CLI) plans and applies the difference between this file and the live
// environment. The `railway` package here is only for types: the app never imports it.
//
//   railway login          once
//   railway link           once: choose the project and environment
//   railway config plan    show what would change. Always show the user.
//   railway config apply   only with the user's explicit go-ahead. Never pass --yes or
//                          --confirm-destructive (the second lets an agent delete resources).
//                          An apply is rejected if the environment changed since the plan: plan again.
//
// - Set OWNER/REPO before the first plan.
// - This file is the WHOLE environment: a resource left out of it is deleted on apply.
//   Add things (a postgres("db"), another volume); do not rewrite it.
// - Railway sets PORT, which startServer() reads. Keep one replica: open sockets, in-memory state
//   and the JSON file all live in one process.
// - Secrets are set in the Railway dashboard and named here with preserve() (from "railway/iac").
// - tsconfig.json names this file in `include`, so `bun run typecheck` checks it; naming the
//   folder is not enough, the default skips dot-folders.
import { defineRailway, github, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    source: github("OWNER/REPO", { branch: "main" }),
    build: "bun install && bun run build",
    start: "bun run serve:dist", // dist/ is where the built server finds its bundled JS and CSS
    healthcheck: "/health",
    env: {
      NODE_ENV: "production",
      DATA_PATH: "/data",
    },
    volumeMounts: { "/data": volume("data") }, // the key is the mount path; keeps message.json across deploys
    // domains: ["www.example.com"], // custom domains, once DNS is set up
  });

  return project("paintbrush", { resources: [web] });
});
