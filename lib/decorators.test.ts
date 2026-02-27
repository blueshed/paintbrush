import { describe, test, expect, beforeEach } from "bun:test";
import { Resource, Field, Controller, GET, buildRoutes, serverRef } from "./decorators";
import { memoryStore } from "./stores";
import type { Store } from "./stores";

// ── Helpers ──

function jsonReq(body: object): Request {
  return new Request("http://test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putReq(body: object): Request {
  return new Request("http://test", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function withParams(req: Request, params: Record<string, string>): any {
  return Object.assign(req, { params });
}

// ── Test resource ──

let store: Store<any>;

function makeTestResource() {
  store = memoryStore();

  @Resource("/api/items", store, { notify: "items" })
  class Item {
    @Field({ required: true }) accessor name: string = "";
    @Field() accessor status: string = "draft";
    @Field({ readonly: true }) accessor createdAt: string = "";
    id: string = "";
  }

  return Item;
}

// ── CRUD tests ──

describe("buildRoutes — CRUD", () => {
  let routes: any;

  beforeEach(() => {
    serverRef.current = null;
    const Item = makeTestResource();
    routes = buildRoutes(Item);
  });

  test("GET list returns empty array initially", async () => {
    const res = await routes["/api/items"].GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("POST creates an item with defaults", async () => {
    const res = await routes["/api/items"].POST(jsonReq({ name: "Test" }));
    expect(res.status).toBe(201);

    const item = await res.json();
    expect(item.name).toBe("Test");
    expect(item.status).toBe("draft");
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
  });

  test("POST rejects missing required field", async () => {
    const res = await routes["/api/items"].POST(jsonReq({ status: "active" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("name");
  });

  test("GET list returns created items", async () => {
    await routes["/api/items"].POST(jsonReq({ name: "A" }));
    await routes["/api/items"].POST(jsonReq({ name: "B" }));

    const res = await routes["/api/items"].GET();
    const items = await res.json();
    expect(items).toHaveLength(2);
    expect(items.map((i: any) => i.name)).toEqual(["A", "B"]);
  });

  test("GET by id returns item", async () => {
    const createRes = await routes["/api/items"].POST(jsonReq({ name: "Find me" }));
    const { id } = await createRes.json();

    const res = await routes["/api/items/:id"].GET(withParams(new Request("http://test"), { id }));
    expect(res.status).toBe(200);
    const item = await res.json();
    expect(item.name).toBe("Find me");
  });

  test("GET by id returns 404 for missing item", async () => {
    const res = await routes["/api/items/:id"].GET(withParams(new Request("http://test"), { id: "nope" }));
    expect(res.status).toBe(404);
  });

  test("PUT updates item fields", async () => {
    const createRes = await routes["/api/items"].POST(jsonReq({ name: "Original" }));
    const { id } = await createRes.json();

    const res = await routes["/api/items/:id"].PUT(withParams(putReq({ name: "Updated", status: "active" }), { id }));
    expect(res.status).toBe(200);
    const item = await res.json();
    expect(item.name).toBe("Updated");
    expect(item.status).toBe("active");
  });

  test("PUT strips readonly fields", async () => {
    const createRes = await routes["/api/items"].POST(jsonReq({ name: "Immutable" }));
    const created = await createRes.json();

    const res = await routes["/api/items/:id"].PUT(
      withParams(putReq({ createdAt: "hacked" }), { id: created.id }),
    );
    const item = await res.json();
    expect(item.createdAt).toBe(created.createdAt);
  });

  test("PUT returns 404 for missing item", async () => {
    const res = await routes["/api/items/:id"].PUT(withParams(putReq({ name: "X" }), { id: "nope" }));
    expect(res.status).toBe(404);
  });

  test("DELETE removes item", async () => {
    const createRes = await routes["/api/items"].POST(jsonReq({ name: "Doomed" }));
    const { id } = await createRes.json();

    const res = await routes["/api/items/:id"].DELETE(withParams(new Request("http://test", { method: "DELETE" }), { id }));
    expect(res.status).toBe(204);

    const listRes = await routes["/api/items"].GET();
    expect(await listRes.json()).toEqual([]);
  });

  test("DELETE returns 404 for missing item", async () => {
    const res = await routes["/api/items/:id"].DELETE(withParams(new Request("http://test", { method: "DELETE" }), { id: "nope" }));
    expect(res.status).toBe(404);
  });
});

// ── Notify / publish tests ──

describe("buildRoutes — notify publish", () => {
  let routes: any;
  let published: { topic: string; message: string }[];

  beforeEach(() => {
    published = [];
    serverRef.current = {
      publish(topic: string, message: string) {
        published.push({ topic, message });
      },
    };
    const Item = makeTestResource();
    routes = buildRoutes(Item);
  });

  test("POST publishes create message", async () => {
    await routes["/api/items"].POST(jsonReq({ name: "New" }));

    expect(published).toHaveLength(1);
    const msg = JSON.parse(published[0].message);
    expect(published[0].topic).toBe("items");
    expect(msg.action).toBe("create");
    expect(msg.resource).toBe("items");
    expect(msg.item.name).toBe("New");
  });

  test("PUT publishes update message with changed fields", async () => {
    const createRes = await routes["/api/items"].POST(jsonReq({ name: "Before" }));
    const { id } = await createRes.json();
    published = [];

    await routes["/api/items/:id"].PUT(withParams(putReq({ status: "active" }), { id }));

    expect(published).toHaveLength(1);
    const msg = JSON.parse(published[0].message);
    expect(msg.action).toBe("update");
    expect(msg.id).toBe(id);
    expect(msg.fields.status).toBe("active");
  });

  test("DELETE publishes delete message", async () => {
    const createRes = await routes["/api/items"].POST(jsonReq({ name: "Bye" }));
    const { id } = await createRes.json();
    published = [];

    await routes["/api/items/:id"].DELETE(withParams(new Request("http://test", { method: "DELETE" }), { id }));

    expect(published).toHaveLength(1);
    const msg = JSON.parse(published[0].message);
    expect(msg.action).toBe("delete");
    expect(msg.id).toBe(id);
  });

  test("no publish when serverRef is null", async () => {
    serverRef.current = null;
    await routes["/api/items"].POST(jsonReq({ name: "Silent" }));
    expect(published).toHaveLength(0);
  });
});

// ── No-notify resource ──

describe("buildRoutes — resource without notify", () => {
  test("does not publish on writes", async () => {
    const published: any[] = [];
    serverRef.current = { publish(_t: string, _m: string) { published.push(1); } };

    const quietStore = memoryStore();

    @Resource("/api/quiet", quietStore)
    class Quiet {
      @Field({ required: true }) accessor label: string = "";
      id: string = "";
    }

    const routes = buildRoutes(Quiet);
    await routes["/api/quiet"].POST(jsonReq({ label: "Shh" }));
    expect(published).toHaveLength(0);
  });
});

// ── @Controller + @GET ──

describe("buildRoutes — @Controller with custom routes", () => {
  test("custom @GET handler is callable", async () => {
    @Controller
    class Health {
      @GET("/api/health")
      async check() {
        return Response.json({ ok: true });
      }
    }

    const routes = buildRoutes(Health);
    const res = await routes["/api/health"].GET(new Request("http://test"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
