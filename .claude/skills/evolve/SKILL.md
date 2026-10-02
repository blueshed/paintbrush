---
name: evolve
description: "Evolve a resource in this app: from an HTTP route to a WebSocket for realtime, then to a delta document that several people edit live, and beyond to eta. Use when the user wants a resource to update live, to be shared between people, or to move from a JSON file to SQLite or Postgres."
---

# Evolving a resource

A resource starts as HTTP routes: `GET` and `PUT /api/message`, a store that fetches, a view that draws. It evolves in steps, and at every step the client route and the view keep their names; only what is under them changes.

| Step | A resource is | Use it when |
|---|---|---|
| 1. HTTP routes (what the app has) | `GET`/`PUT` handlers, a fetching store | one person, or changes need not be seen live |
| 2. WebSocket | the same, plus a socket the server pushes on | the page must update when the server says so, and the data is not shared documents |
| 3. Document (delta) | a document that every open window holds and every write patches | several people read and write the same data and each should see the others' changes |
| 4. eta | a document drawn on the server, with who may write what stated as stories | the app is several people at once, and who sees what matters |

Step 3 has its own ladder, and the browser code does not change as you climb it: delta keeps the document in a JSON file, then SQLite, then Postgres. The `delta-doc` skill (installed with delta) says how. Step 4 starts from eta's own `first-app.md` and its `eta-app` skill; a resource's type and view are what you bring to it. This file covers steps 2 and 3, which were run on Bun 1.4.2 with railroad 0.15.1 and delta 0.11.0.

## Step 2: a WebSocket

- Route and handlers in `src/server.ts`:

```ts
// in routes:
"/ws": (req, server) => {
  if (server.upgrade(req)) return;
  return new Response("Upgrade required", { status: 426 });
},

// next to routes and fetch:
websocket: {
  open(ws) { ws.send("connected"); },
  message(ws, msg) { ws.send(`echo: ${msg}`); },
  close(ws) {},
},
```

- Client, in the resource's store (`<name>.ts`):

```ts
const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
ws.onmessage = (e) => console.log(e.data);
```

- Test:

```ts
test("websocket connects and echoes", async () => {
  expect((await api("/ws")).status).toBe(426); // plain HTTP

  const ws = new WebSocket(new URL("/ws", server.url.href.replace("http", "ws")));
  const messages: string[] = [];
  await new Promise<void>((done) => {
    ws.onmessage = (e) => {
      messages.push(String(e.data));
      if (messages.length === 1) ws.send("hi");
      else done();
    };
  });
  ws.close();
  expect(messages).toEqual(["connected", "echo: hi"]);
});
```

Keep one replica on Railway: open sockets live in one process.

## Step 3: a document with delta

[@blueshed/delta](https://github.com/blueshed/delta) keeps the document, applies a write as JSON-Patch ops, and tells every open window. It rides one WebSocket, and its browser side is a railroad signal, so a view needs no glue. This step turns `message` into a document: its HTTP routes go, and its store becomes `openDoc`, which has the same shape (`data` is a signal).

1. `bun add @blueshed/delta`, then `bunx @blueshed/delta install-skills` (delta's skill, and railroad's refreshed). Read the `delta-doc` skill: its rules include one op vocabulary, and never updating locally after a send, because the op comes back and renders itself.

2. `src/resources/message/message-api.ts` keeps only the type, and loses `messageApi`:

```ts
/** Message: the shape of the "message" document, shared by server and client. */
export type Message = { message: string };
```

3. `src/server.ts`: `startServer` becomes `async` (registering a document is async); `src/main.ts` and the tests `await` it (`const server = await startServer();`, and `server = await startServer(...)` typed `Awaited<ReturnType<typeof startServer>>`).

```ts
import { createWs, registerDoc } from "@blueshed/delta/server";
import type { Message } from "./resources/message/message-api";

// in startServer, before Bun.serve:
const ws = createWs();
await registerDoc<Message>(ws, "message", {
  file: `${dataDir}/message.json`,
  empty: { message: "Hello" },
});

// in routes, replacing "/api/message":
[ws.path]: ws.upgrade, // the one WebSocket: every document rides it

// next to routes and fetch:
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

5. `src/resources/message/message-view.tsx`: follow the document, unless the box holds typing that has not been saved. `send` resolves once the server has applied the write and told it back, so "Saved" is still said only when the server has said so. There is no load to fail, so `failed` goes.

```tsx
import { effect, signal } from "@blueshed/railroad";
import { toast } from "../toast";
import { message } from "./message";

export function MessageView() {
  const text = signal(message.data.peek()?.message ?? "");
  let shown = text.peek(); // what the box last took from the document

  effect(() => {
    const doc = message.data.get();
    if (doc && text.peek() === shown) {
      shown = doc.message;
      text.set(doc.message);
    }
  });

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
      <p class="help">Edit the message above and hit <strong>Save</strong> to persist it.</p>
    </>
  );
}
```

### Tests for step 3

The GET and PUT message route tests go, and so do the "saved message is in the box", "survives a reload" and "cannot be loaded" browser tests (the load failure is now the status line's alone). Add two, each opening a second window of its own:

```ts
test("saving says Saved, and another window sees it", async () => {
  const other = new Bun.WebView({ width: 1280, height: 800, console: globalThis.console });
  try {
    await open();
    await other.navigate(`${server.url.href}?other`);
    await waitFor(`document.querySelector("textarea")?.value === "Hello"`);

    await replaceText("textarea", "typed in the browser");
    await view.click("button.primary");
    await waitFor(`document.querySelector(".toast.show.notify")?.textContent === "Saved"`);

    for (let i = 0; i < 100; i++) {
      if (await other.evaluate<boolean>(`document.querySelector("textarea")?.value === "typed in the browser"`)) break;
      await Bun.sleep(50);
    }
    expect(await other.evaluate<string>(`document.querySelector("textarea").value`)).toBe("typed in the browser");
  } finally {
    other.close();
  }
});

test("typing that is not saved is not overwritten by a change from another window", async () => {
  const other = new Bun.WebView({ width: 1280, height: 800, console: globalThis.console });
  try {
    await open();
    await waitFor(`document.querySelector("textarea")?.value === "typed in the browser"`);
    await replaceText("textarea", "half-typed");

    await other.navigate(`${server.url.href}?other2`);
    await other.evaluate(`new Promise((r) => setTimeout(r, 300))`); // let it load and open the document
    await other.click("textarea");
    await other.type("!");
    await other.click("button.primary");
    await other.evaluate(`new Promise((r) => setTimeout(r, 500))`); // let the change reach this window

    expect(await view.evaluate<string>(`document.querySelector("textarea").value`)).toBe("half-typed");
  } finally {
    other.close();
  }
});
```

A refused write rejects `send`, and the view says "Not saved". Test your own refusals. On Railway the document file is already on the volume (`DATA_PATH`); one replica still holds until the backend is Postgres.
