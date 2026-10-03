---
name: evolve
description: "Evolve a resource in this app: from HTTP routes and a WebSocket push to a delta document that several people edit live, and beyond to eta. Use when the user wants a resource to update live, to be shared between people, or to move from a JSON file to SQLite or Postgres."
---

# Evolving a resource

A resource starts as HTTP routes: `GET` and `PUT /api/message`, a store that fetches, a view that draws. It evolves in steps, and at every step the client route and the view keep their names; only what is under them changes.

| Step | A resource is | Use it when |
|---|---|---|
| 1. HTTP routes (`status`) | `GET`/`PUT` handlers, a fetching store | one person, or changes need not be seen live |
| 2. HTTP routes and a WebSocket push (`message`) | the same, and each write is published to a topic every page subscribes to | pages must follow the server, and a write is one whole value |
| 3. Document (delta) | a document that every open window holds and every write patches | several people write parts of the same data and each should see the others' changes |
| 4. eta | a document drawn on the server, with who may write what stated as stories | the app is several people at once, and who sees what matters |

Step 3 has its own ladder, and the browser code does not change as you climb it: delta keeps the document in a JSON file, then SQLite, then Postgres. The `delta-doc` skill (installed with delta) says how. A table or a bucket that is not a shared document is plain Bun: `CLAUDE.md`'s "SQLite and S3". Step 4 starts from eta's own `first-app.md` and its `eta-app` skill; a resource's type and view are what you bring to it. This file covers steps 2 and 3, which were run on Bun 1.4.2 with railroad 0.15.1 and delta 0.11.0.

## Step 2: a WebSocket push

`message` is this step, so copy it. In short:

- `src/server.ts` has the one `/ws` route (`server.upgrade(req)`, else 426), and `websocket.open` subscribes each socket to a topic per resource: `ws.subscribe("<name>")`.
- The handler that writes publishes what it wrote: `server.publish("<name>", JSON.stringify(value))`. A route handler's second argument is the server.
- The store opens a socket and sets its signal from each message. It opens the socket again when it closes, and loads again, since a write may have been missed meanwhile.
- The view follows the signal unless the box holds typing that has not been saved. It keeps `shown`, what it last took from the server, and takes a new value when the box still holds `shown` or already holds the new value. Without that second condition, a window that saved stops following the others.
- Tests: `/ws` answers 426 over plain HTTP, and a socket is told of a write; another window sees a save, and the first window sees the other's save afterwards; unsaved typing is not overwritten; after a server restart the page loads what changed and follows again.

Keep one replica on Railway: open sockets live in one process.

## Step 3: a document with delta

[@blueshed/delta](https://github.com/blueshed/delta) keeps the document, applies a write as JSON-Patch ops, and tells every open window. It rides one WebSocket, and its browser side is a railroad signal, so a view needs no glue. This step turns `message` into a document. Its HTTP routes and the app's own `/ws` go, and its store becomes `openDoc`, which has the same shape (`data` is a signal) and reconnects by itself.

1. `bun add @blueshed/delta`, then `bunx @blueshed/delta install-skills` (delta's skill, and railroad's refreshed). Read the `delta-doc` skill: its rules include one op vocabulary, and never updating locally after a send, because the op comes back and renders itself.

2. `src/resources/message/message-api.ts` keeps only the type, and loses `messageApi`:

```ts
/** Message: the shape of the "message" document, shared by server and client. */
export type Message = { message: string };
```

3. `src/server.ts`: `startServer` becomes `async` (registering a document is async), and `src/main.ts` awaits it (`const server = await startServer();`). The `/api/message` and `/ws` routes go, and so does the `websocket` block; delta's take their place. If another resource still publishes on the app's socket, it moves to a delta document or a method too, since delta owns `/ws`.

```ts
import { createWs, registerDoc } from "@blueshed/delta/server";
import type { Message } from "./resources/message/message-api";

// in startServer, before Bun.serve:
const ws = createWs();
await registerDoc<Message>(ws, "message", {
  file: `${dataDir}/message.json`,
  empty: { message: "Hello" },
});

// in routes, replacing "/api/message" and "/ws":
[ws.path]: ws.upgrade, // the one WebSocket: every document rides it

// replacing the websocket block:
websocket: ws.websocket,

// after Bun.serve (const server = Bun.serve({...})):
ws.setServer(server);
return server;
```

4. `src/resources/message/message.ts`: the store is the document.

```ts
import { connectWs, openDoc } from "@blueshed/delta/client";
import type { Message } from "./message-api";

/** The "message" document. `message.data` is a railroad signal, null until it arrives. */
export const message = openDoc<Message>("message", connectWs("/ws"));
```

5. `src/resources/message/message-view.tsx`: the view keeps following as before, now `message.data`. `send` resolves once the server has applied the write and told it back, so "Saved" is still said only when the server has said so. There is no load to fail, so `failed` goes.

```tsx
import { effect, signal } from "@blueshed/railroad";
import { toast } from "../toast";
import { message } from "./message";

export function MessageView() {
  const text = signal(message.data.peek()?.message ?? "");
  let shown = text.peek(); // what the box last took from the document

  // Follow the document, unless the box holds typing that has not been saved
  effect(() => {
    const doc = message.data.get();
    if (doc && (text.peek() === shown || text.peek() === doc.message)) {
      shown = doc.message;
      text.set(doc.message);
    }
  });

  // Say "Saved" only once the server has said so
  async function onsave() {
    try {
      await message.send([{ op: "replace", path: "/message", value: text.peek() }]);
      toast("Saved");
    } catch {
      toast("Not saved", "alert");
    }
  }

  return (
    <>
      <h1>Message</h1>
      <textarea
        value={text}
        oninput={(e: Event) => text.set((e.currentTarget as HTMLTextAreaElement).value)}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter" && e.metaKey) void onsave();
        }}
      ></textarea>
      <div class="toolbar">
        <button class="primary" onclick={onsave}>Save</button>
      </div>
      <p class="help">Edit the message above and hit <strong>Save</strong>: every open page shows it.</p>
    </>
  );
}
```

### Tests for step 3

There is no HTTP for the message any more, so a test writes it the way a person does, in a window. The two-window and unsaved-typing tests stay as they are, apart from their first lines.

- The server is awaited: `let server: Awaited<ReturnType<typeof startServer>>;`, `beforeAll(async () => { server = await startServer(...); ... })`, and the same in the restart test.
- These go: the `putMessage` helper; the three `/api/message` route tests; the `/ws` test (delta tests its own socket); "the saved message is in the box"; "a save the server did not take says Not saved" (it broke `fetch`, which a save no longer uses).
- "survives a reload" waits for `"Hello"` first instead of `"in the box"`, and drops its `GET /api/message` check: the reload is the check.
- The load-failure test is about the status alone: it is named "a status that cannot be loaded says so" and drops the message line.
- The two-window test starts from what the reload test left: `open()`, then wait in both windows for `"typed in the browser"`, with no `putMessage`. The unsaved-typing test drops its `GET /api/message` check.
- The restart test awaits `startServer`, and checks that it follows again with a save from a second window instead of a `PUT`:

```ts
  server = await startServer({ port, dev: false, dataDir });
  await waitFor(`document.querySelector("textarea")?.value === "changed while down"`);

  await withOtherWindow(async (other, waitForOther) => {
    await waitForOther(`document.querySelector("textarea")?.value === "changed while down"`);
    await other.click("textarea");
    await other.type("!");
    await other.click("button.primary");
  });
  await waitFor(`document.querySelector("textarea")?.value === "changed while down!"`);
```

A refused write rejects `send`, and the view says "Not saved". Test your own refusals. On Railway the document file is already on the volume (`DATA_PATH`); one replica still holds until the backend is Postgres.
