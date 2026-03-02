import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { Message } from "./message";

const dataDir = process.env.DATA_PATH ?? import.meta.dir;
const file = join(dataDir, "message.json");

if (!existsSync(file)) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ message: "Hello from Paintbrush" }, null, 2));
}

export const getMessage = () =>
  Response.json(JSON.parse(readFileSync(file, "utf-8")) as Message);

export const putMessage = async (req: Request) => {
  const body: Message = await req.json();
  writeFileSync(file, JSON.stringify(body, null, 2));
  return Response.json(body);
};
