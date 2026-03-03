/**
 * Decorators — TC39 stage-3 decorators for routes and resources.
 *
 * @Resource(path, store, opts?)  — class decorator: declares a data resource
 * @Field(opts?)           — auto-accessor decorator: declares a field
 * @Auth(role?)            — class/method decorator: requires authentication
 * @GET(path) etc.         — method decorators: custom route endpoints
 * buildRoutes(...classes) — reads metadata, returns Bun.serve() route object
 *
 * Metadata is stored on the class via a private symbol since Bun 1.3.10
 * provides context.metadata but doesn't yet attach it to Symbol.metadata.
 */

import type { Store } from "./stores";
import { tryInject } from "./shared";
import type { SessionStore } from "./sessions";

// ── Metadata ──

const META = Symbol("paintbrush");

/** Valid notify topic names, populated by buildRoutes(). */
const _notifyTopics = new Set<string>();
export function getNotifyTopics(): ReadonlySet<string> { return _notifyTopics; }

interface FieldMeta {
  name: string;
  required: boolean;
  readonly: boolean;
}

interface ResourceMeta {
  basePath: string;
  store: Store<any>;
  notify?: string;
}

interface RouteMeta {
  method: string;
  path: string;
  handler: Function;
  methodName: string;
  auth?: { role?: string };
}

interface ClassMeta {
  resource?: ResourceMeta;
  fields: FieldMeta[];
  routes: RouteMeta[];
  auth?: { role?: string };
}

function getMeta(context: DecoratorMetadataObject): ClassMeta {
  context[META] ??= { fields: [], routes: [] };
  return context[META] as ClassMeta;
}

type RouteHandler = (req: any) => Response | Promise<Response>;
type RouteObject = Record<string, Record<string, RouteHandler>>;

// ── @Field decorator ──

interface FieldOptions {
  required?: boolean;
  readonly?: boolean;
}

export function Field(opts: FieldOptions = {}) {
  return function <This, V>(
    _target: ClassAccessorDecoratorTarget<This, V>,
    context: ClassAccessorDecoratorContext<This, V>,
  ): void {
    getMeta(context.metadata).fields.push({
      name: String(context.name),
      required: opts.required ?? false,
      readonly: opts.readonly ?? false,
    });
  };
}

// ── @Resource decorator ──

export function Resource(basePath: string, store: Store<any>, opts?: { notify?: string }) {
  return function <T extends new (...args: any[]) => any>(
    target: T,
    context: ClassDecoratorContext<T>,
  ): void {
    const meta = getMeta(context.metadata);
    meta.resource = { basePath, store, notify: opts?.notify };
    (target as any)[META] = meta;
  };
}

// ── @Auth decorator ──

/**
 * Protects routes by role. Works on classes or methods.
 *
 * On a class: protects all CRUD routes and custom endpoints.
 * On a method: protects that single endpoint (overrides class-level).
 * No role argument = any authenticated user.
 *
 *   @Auth("admin")
 *   @Resource("/api/gifts", sqliteStore("gifts"))
 *   class Gift { ... }
 */
export function Auth(role?: string) {
  // Returns a decorator that works on both classes and methods
  return function (target: any, context: ClassDecoratorContext | ClassMethodDecoratorContext): void {
    if (context.kind === "class") {
      getMeta(context.metadata).auth = { role };
      // Also attach metadata to class (same as @Resource/@Controller)
      (target as any)[META] = getMeta(context.metadata);
    } else if (context.kind === "method") {
      // Find the route entry for this method and tag it
      // The route may not exist yet if @Auth is applied before @GET,
      // so we store it on metadata keyed by method name for later pickup
      const meta = getMeta(context.metadata);
      (meta as any)[`_auth_${String(context.name)}`] = { role };
    }
  };
}

// ── @GET, @POST, @PUT, @DELETE decorators ──

function routeDecorator(method: string, path: string) {
  return function <This>(
    target: (this: This, req: any) => Response | Promise<Response>,
    context: ClassMethodDecoratorContext<This>,
  ): void {
    const meta = getMeta(context.metadata);
    meta.routes.push({ method, path, handler: target, methodName: String(context.name) });
  };
}

export function GET(path: string) { return routeDecorator("GET", path); }
export function POST(path: string) { return routeDecorator("POST", path); }
export function PUT(path: string) { return routeDecorator("PUT", path); }
export function DELETE(path: string) { return routeDecorator("DELETE", path); }

// ── @Controller ──

function ensureMeta<T extends new (...args: any[]) => any>(
  target: T,
  context: ClassDecoratorContext<T>,
): void {
  (target as any)[META] = getMeta(context.metadata);
}

export function Controller(
  target: new (...args: any[]) => any,
  context: ClassDecoratorContext,
): void {
  ensureMeta(target, context);
}

// ── Auth wrapper ──

function wrapWithAuth(handler: RouteHandler, role?: string): RouteHandler {
  return async (req: any) => {
    const sessions = tryInject<SessionStore>("sessions");
    if (!sessions) return Response.json({ error: "Auth not configured" }, { status: 500 });
    const session = await sessions.fromRequest(req);
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (role && session.role !== role) return Response.json({ error: "Forbidden" }, { status: 403 });
    req.session = session;
    return handler(req);
  };
}

function maybeWrap(handler: RouteHandler, auth?: { role?: string }): RouteHandler {
  return auth ? wrapWithAuth(handler, auth.role) : handler;
}

// ── buildRoutes ──

/**
 * Reads decorator metadata from classes and returns a plain route object
 * for Bun.serve(). Handles both @Resource classes (CRUD) and classes
 * with @GET/@POST etc. method decorators (custom endpoints).
 *
 * If @Auth is present, handlers are wrapped with session checks.
 */
export function buildRoutes(...classes: (new (...args: any[]) => any)[]): RouteObject {
  const routes: RouteObject = {};

  for (const cls of classes) {
    const meta = (cls as any)[META] as ClassMeta | undefined;
    if (!meta) continue;

    const classAuth = meta.auth;

    // Resource CRUD routes
    if (meta.resource) {
      const requiredFields = meta.fields.filter((f) => f.required).map((f) => f.name);
      const readonlyFields = meta.fields.filter((f) => f.readonly).map((f) => f.name);
      const { basePath, store, notify } = meta.resource;
      if (notify) _notifyTopics.add(notify);
      const defaults = Object.fromEntries(
        meta.fields.map((f) => [f.name, (new cls() as any)[f.name]]),
      );

      routes[basePath] = {
        GET: maybeWrap(async () => {
          return Response.json(await store.read());
        }, classAuth),
        POST: maybeWrap(async (req: Request) => {
          const body = await req.json();
          for (const field of requiredFields) {
            if (!body[field]) {
              return Response.json({ error: `${field} is required` }, { status: 400 });
            }
          }
          const items = await store.read();
          const id = body.id ?? crypto.randomUUID();
          const item = { ...defaults, ...body, id, createdAt: body.createdAt ?? new Date().toISOString() };
          items.push(item);
          await store.write(items);
          const server = tryInject<any>("server");
          if (notify && server) {
            server.publish(notify, JSON.stringify({ resource: notify, action: "create", item }));
          }
          return Response.json(item, { status: 201 });
        }, classAuth),
      };

      routes[`${basePath}/:id`] = {
        GET: maybeWrap(async (req: any) => {
          const items = await store.read();
          const item = items.find((i: any) => i.id === req.params.id);
          return item
            ? Response.json(item)
            : Response.json({ error: "Not found" }, { status: 404 });
        }, classAuth),
        PUT: maybeWrap(async (req: any) => {
          const items = await store.read();
          const idx = items.findIndex((i: any) => i.id === req.params.id);
          if (idx === -1) return Response.json({ error: "Not found" }, { status: 404 });
          const body = await req.json();
          for (const field of readonlyFields) delete body[field];
          items[idx] = { ...items[idx], ...body, id: req.params.id };
          await store.write(items);
          const server = tryInject<any>("server");
          if (notify && server) {
            server.publish(notify, JSON.stringify({ resource: notify, action: "update", id: req.params.id, fields: body }));
          }
          return Response.json(items[idx]);
        }, classAuth),
        DELETE: maybeWrap(async (req: any) => {
          const items = await store.read();
          const filtered = items.filter((i: any) => i.id !== req.params.id);
          if (filtered.length === items.length) {
            return Response.json({ error: "Not found" }, { status: 404 });
          }
          await store.write(filtered);
          const server = tryInject<any>("server");
          if (notify && server) {
            server.publish(notify, JSON.stringify({ resource: notify, action: "delete", id: req.params.id }));
          }
          return new Response(null, { status: 204 });
        }, classAuth),
      };
    }

    // Custom method-decorated routes
    if (meta.routes.length > 0) {
      const instance = new cls();
      for (const route of meta.routes) {
        routes[route.path] ??= {};
        // Method-level auth (from _auth_ keys) overrides class-level; fall back to class auth
        const methodAuth = (meta as any)[`_auth_${route.methodName}`] as { role?: string } | undefined;
        const auth = methodAuth ?? classAuth;
        routes[route.path][route.method] = maybeWrap(route.handler.bind(instance), auth);
      }
    }
  }

  return routes;
}
