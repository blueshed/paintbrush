import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const file = join(import.meta.dir, "message.json");

export const getMessage = () =>
  Response.json(JSON.parse(readFileSync(file, "utf-8")));

export const putMessage = async (req: Request) => {
  const body = await req.json();
  writeFileSync(file, JSON.stringify(body, null, 2));
  return Response.json(body);
};
