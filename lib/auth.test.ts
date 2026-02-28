import { describe, test, expect, beforeEach } from "bun:test";
import { Resource, Field, Controller, GET, Auth, buildRoutes } from "./decorators";
import { provide } from "./shared";
import { createSessionStore } from "./sessions";
import { createDatabase } from "./sqlite-store";
import { memoryStore } from "./stores";
import type { SessionStore } from "./sessions";

let sessions: SessionStore;

function jsonReq(body: object, cookie?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request("http://test", { method: "POST", headers, body: JSON.stringify(body) });
}

function getReq(cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request("http://test", { headers });
}

function withParams(req: Request, params: Record<string, string>): any {
  return Object.assign(req, { params });
}

beforeEach(() => {
  const db = createDatabase(":memory:");
  sessions = createSessionStore(db);
  provide("sessions", sessions);
  provide("server", null);
});

describe("@Auth on @Resource", () => {
  function makeProtectedResource() {
    const store = memoryStore();

    @Auth("admin")
    @Resource("/api/secrets", store)
    class Secret {
      @Field({ required: true }) accessor name: string = "";
      id: string = "";
    }

    return buildRoutes(Secret);
  }

  test("GET without session returns 401", async () => {
    const routes = makeProtectedResource();
    const res = await routes["/api/secrets"].GET(getReq());
    expect(res.status).toBe(401);
  });

  test("GET with wrong role returns 403", async () => {
    const routes = makeProtectedResource();
    const session = await sessions.create("user1", "guest", 3600);
    const res = await routes["/api/secrets"].GET(getReq(`sid=${session.id}`));
    expect(res.status).toBe(403);
  });

  test("GET with correct role returns 200", async () => {
    const routes = makeProtectedResource();
    const session = await sessions.create("user1", "admin", 3600);
    const res = await routes["/api/secrets"].GET(getReq(`sid=${session.id}`));
    expect(res.status).toBe(200);
  });

  test("POST with correct role creates item", async () => {
    const routes = makeProtectedResource();
    const session = await sessions.create("user1", "admin", 3600);
    const res = await routes["/api/secrets"].POST(jsonReq({ name: "Top Secret" }, `sid=${session.id}`));
    expect(res.status).toBe(201);
  });

  test("DELETE without session returns 401", async () => {
    const routes = makeProtectedResource();
    const session = await sessions.create("user1", "admin", 3600);
    // First create an item
    const createRes = await routes["/api/secrets"].POST(jsonReq({ name: "X" }, `sid=${session.id}`));
    const { id } = await createRes.json();

    // Try to delete without auth
    const req = withParams(new Request("http://test", { method: "DELETE" }), { id });
    const res = await routes["/api/secrets/:id"].DELETE(req);
    expect(res.status).toBe(401);
  });
});

describe("@Auth on @Controller methods", () => {
  function makeController() {
    @Controller
    class Dashboard {
      @Auth("admin")
      @GET("/api/admin/stats")
      async stats(req: any) {
        return Response.json({ user: req.session.userId });
      }

      @GET("/api/public/health")
      async health() {
        return Response.json({ ok: true });
      }
    }

    return buildRoutes(Dashboard);
  }

  test("protected method returns 401 without session", async () => {
    const routes = makeController();
    const res = await routes["/api/admin/stats"].GET(getReq());
    expect(res.status).toBe(401);
  });

  test("protected method returns 200 with correct role and has session on req", async () => {
    const routes = makeController();
    const session = await sessions.create("admin1", "admin", 3600);
    const res = await routes["/api/admin/stats"].GET(getReq(`sid=${session.id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBe("admin1");
  });

  test("unprotected method works without session", async () => {
    const routes = makeController();
    const res = await routes["/api/public/health"].GET(getReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("@Auth with no role (any authenticated)", () => {
  function makeAnyAuthResource() {
    const store = memoryStore();

    @Auth()
    @Resource("/api/things", store)
    class Thing {
      @Field({ required: true }) accessor name: string = "";
      id: string = "";
    }

    return buildRoutes(Thing);
  }

  test("rejects unauthenticated", async () => {
    const routes = makeAnyAuthResource();
    const res = await routes["/api/things"].GET(getReq());
    expect(res.status).toBe(401);
  });

  test("accepts any authenticated role", async () => {
    const routes = makeAnyAuthResource();
    const session = await sessions.create("user1", "guest", 3600);
    const res = await routes["/api/things"].GET(getReq(`sid=${session.id}`));
    expect(res.status).toBe(200);
  });
});
