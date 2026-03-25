import type { Status } from "./status";

const startedAt = Date.now();

export const getStatus = () => {
  const dataDir = process.env.DATA_PATH ?? import.meta.dir;
  return Response.json({
    dataPath: dataDir,
    persistent: !!process.env.DATA_PATH,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    bun: Bun.version,
  } satisfies Status);
};
