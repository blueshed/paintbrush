import { loggedRequest, createLogger } from "@lib/logger";
import type { Status } from "./status";

const startedAt = Date.now();
const log = createLogger("status");

const getStatusImpl = () => {
  const dataDir = process.env.DATA_PATH ?? import.meta.dir;
  return Response.json({
    dataPath: dataDir,
    persistent: !!process.env.DATA_PATH,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    bun: Bun.version,
  } satisfies Status);
};

export const getStatus = loggedRequest("status", getStatusImpl);
