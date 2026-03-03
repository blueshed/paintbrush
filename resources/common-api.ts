import { join } from "path";

const logoFile = Bun.file(join(import.meta.dir, "../logo.png"));

export const getLogo = () =>
  new Response(logoFile, { headers: { "Content-Type": logoFile.type } });

export const notFound = () =>
  Response.json({ error: "Not found" }, { status: 404 });
