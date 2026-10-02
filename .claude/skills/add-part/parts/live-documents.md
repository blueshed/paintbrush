# Live documents (delta)

When: several people read and write the same data and each should see the others' changes as they happen. [@blueshed/delta](https://github.com/blueshed/delta) keeps the document, applies a write as JSON-Patch ops, and tells every open window. It rides one WebSocket, and its browser side is a railroad signal, so a view needs no glue.

This replaces a resource's GET and PUT routes, and its `resource()` store with delta's `openDoc`: the handle has the same shape (`data` is a signal), so the view changes only where it loads and saves. The steps below turn `message` into a document. delta starts on the smallest backend, a JSON file, and graduates to SQLite or Postgres without the browser code changing; the `delta-doc` skill says how.

## Steps

1. `bun add @blueshed/delta`, then `bunx @blueshed/delta install-skills` (it installs delta's skill and refreshes railroad's). Read the `delta-doc` skill before going further: it has the rules, among them one op vocabulary, and never update locally after a send, because the op comes back and renders itself.

2. `src/resources/message/api.ts` keeps only the type, and loses `messageRoutes` and its `jsonFile` import:

```ts
/** Message: the shape of the "message" document, shared by server and client. */
export type Message = { message: string };
```

3. `src/server.ts`: `startServer` becomes `async` (registering a document is async), and `src/main.ts` and the tests `await` it (`const server = await startServer();`, and `server = await startServer(...)` with its type `Awaited<ReturnType<typeof startServer>>`).

```ts
import { createWs, registerDoc } from "@blueshed/delta/server";
import type { Message } from "./resources/message/api";

// in startServer, before Bun.serve:
const ws = createWs();
await registerDoc<Message>(ws, "message", {
  file: `${dataDir}/message.json`,
  empty: { message: "Hello" },
});

// in routes, replacing ...messageRoutes(dataDir):
[ws.path]: ws.upgrade, // the one WebSocket: every document rides it

// next to routes and fetch:
websocket: ws.websocket,

// after Bun.serve (const server = Bun.serve({...})):
ws.setServer(server);
return server;
```

4. `src/resources/message/store.ts`: the store is the document.

```ts
import { connectWs, openDoc } from "@blueshed/delta/client";
import type { Message } from "./api";

/** The "message" document. `message.data` is a railroad signal, null until it arrives. */
export const message = openDoc<Message>("message", connectWs("/ws"));
```

5. `src/resources/message/view.tsx`: follow the document, unless the box holds typing that has not been saved. `send` resolves once the server has applied the write and told it back, so "Saved" is still said only when the server has said so. There is no load to fail, so `failed` goes.

```tsx
import { effect, signal } from "@blueshed/railroad";
import { toast } from "../toast";
import { message } from "./store";

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

## Tests

The GET and PUT route tests go, and so do the "saved message is in the box", "survives a reload" and "message cannot be loaded" browser tests. The test server starts with `await startServer(...)`. Add two, which open a second window of their own:

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

A refused write rejects `send`, and the view says "Not saved". Test your own refusals.

On Railway the document file is already on the volume (`DATA_PATH`). One replica still holds, until the backend is Postgres.
