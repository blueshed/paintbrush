/**
 * Message: a singleton resource, kept as one JSON file in the data folder.
 *
 * The type is shared. The client imports it as a type only (`import type`), so none
 * of the server code below reaches the browser bundle.
 */
import { jsonFile } from "../json-file";

export type Message = { message: string };

export function messageRoutes(dataDir: string) {
  const stored = jsonFile<Message>(`${dataDir}/message.json`, { message: "Hello" });

  return {
    "/api/message": {
      GET: async () => Response.json(await stored.read()),

      PUT: async (req: Request) => {
        const body = await req.json().catch(() => null);
        if (typeof body?.message !== "string") {
          return Response.json({ error: "message must be a string" }, { status: 400 });
        }
        return Response.json(await stored.write({ message: body.message }));
      },
    },
  };
}
