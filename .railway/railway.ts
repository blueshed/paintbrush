import { defineRailway, github, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    source: github("OWNER/REPO", { branch: "main" }),
    build: "bun install && bun run build",
    start: "bun run serve:dist",
    healthcheck: "/health",
    env: {
      NODE_ENV: "production",
      DATA_PATH: "/data",
    },
    volumeMounts: { "/data": volume("data") }, // the key is the mount path; keeps the data across deploys
    // domains: ["www.example.com"], // custom domains, once DNS is set up
  });

  return project("paintbrush", { resources: [web] });
});
