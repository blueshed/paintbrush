import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Controller, GET, PUT } from "../../lib/decorators";

const file = join(import.meta.dir, "message.json");

@Controller
export class Message {
  @GET("/api/message")
  get() {
    return Response.json(JSON.parse(readFileSync(file, "utf-8")));
  }

  @PUT("/api/message")
  async put(req: Request) {
    const body = await req.json();
    writeFileSync(file, JSON.stringify(body, null, 2));
    return Response.json(body);
  }
}
