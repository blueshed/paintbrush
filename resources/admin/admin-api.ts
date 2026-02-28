import { Controller, GET, POST } from "../../lib/decorators";
import { inject } from "../../lib/shared";
import type { DatabaseInstance } from "../../lib/sqlite-store";

@Controller
export class Admin {
  @GET("/api/stats")
  async stats() {
    return Response.json({ notes: "ok" });
  }

  @GET("/admin/backup")
  async download() {
    const { backup } = inject<DatabaseInstance>("db");
    const data = await backup();
    return new Response(data.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=app.db",
      },
    });
  }

  @POST("/admin/restore")
  async upload(req: Request) {
    const { restore } = inject<DatabaseInstance>("db");
    const data = new Uint8Array(await req.arrayBuffer());
    await restore(data);
    return Response.json({ ok: true, message: "Database restored" });
  }
}
