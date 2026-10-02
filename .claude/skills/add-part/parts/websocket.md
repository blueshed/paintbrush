# WebSocket

When: the page needs live updates from the server and they are not documents. If what changes is a document that several people read and write, use the live-documents part instead: it is the same socket with the syncing done.

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

- Client, in a resource's store (`src/resources/<name>/<name>.ts`):

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

Keep one replica on Railway: open sockets and any state kept for them live in a single process.
