import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { tryInject, SERVER } from "@lib/shared";
import { loggedRequest, createLogger } from "@blueshed/railroad";
import type { Message } from "./message";

const dataDir = process.env.DATA_PATH ?? import.meta.dir;
const file = join(dataDir, "message.json");
const log = createLogger("message");

if (!existsSync(file)) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ message: "Hello from Paintbrush" }, null, 2));
}

const getMessageImpl = () =>
  Response.json(JSON.parse(readFileSync(file, "utf-8")) as Message);

const putMessageImpl = async (req: Request) => {
  const body: Message = await req.json();
  writeFileSync(file, JSON.stringify(body, null, 2));
  const server = tryInject(SERVER);
  if (server) {
    server.publish(
      "message",
      JSON.stringify({ resource: "message", action: "update", item: body }),
    );
    log.info("notify → message:update");
  }
  return Response.json(body);
};

export const getMessage = loggedRequest("message", getMessageImpl);
export const putMessage = loggedRequest("message", putMessageImpl);
