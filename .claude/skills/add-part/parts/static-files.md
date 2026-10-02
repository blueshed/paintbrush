# Static files

When: the site serves files the page links to or fetches but does not embed: downloads, data files loaded at runtime. Files the HTML embeds (images, icons, stylesheets) need no part: see the `add-part` skill.

## A folder

- A `public/` folder, served under `/static/`. The folder must exist: the server throws on startup if it is missing.
- Route in `src/server.ts`. The path is resolved from `import.meta.dir`, not the working directory, so it also works from the production build:

```ts
// Static folder (ETag, Range, 304 handled by Bun)
"/static/*": { dir: `${import.meta.dir}/../public` },
```

- Reference files as `/static/<name>` from links and code, for example `<a href="/static/guide.pdf">`.
- Test, one per file the site relies on:

```ts
test("guide.pdf is served from public/", async () => {
  const res = await api("/static/guide.pdf");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("application/pdf");
});
```

## One file at a route of its own

A download whose URL or access is not its filename is a `Response` around `Bun.file()`. Bun streams it from disk and sets `content-type` from the extension. Keep the file in a folder that is committed (`files/`, not `data/`, which `.gitignore` leaves out), resolve the path from `import.meta.dir`, and test it the same way:

```ts
"/download/report": () => new Response(Bun.file(`${import.meta.dir}/../files/report.pdf`)),
```

```ts
test("the report downloads", async () => {
  const res = await api("/download/report");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("application/pdf");
});
```

A `BunFile` remembers a missing file: one whose `exists()` was false still says so after `Bun.write` creates it. Call `Bun.file(path)` again for each read.
