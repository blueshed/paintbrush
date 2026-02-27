/**
 * Decorators — TC39 stage-3 decorators for routes and resources.
 *
 * @Resource(path, store, opts?)  — class decorator: declares a data resource
 * @Field(opts?)           — auto-accessor decorator: declares a field
 * @GET(path) etc.         — method decorators: custom route endpoints
 * buildRoutes(...classes) — reads metadata, returns Bun.serve() route object
 *
 * Metadata is stored on the class via a private symbol since Bun 1.3.10
 * provides context.metadata but doesn't yet attach it to Symbol.metadata.
 */

import type { Store } from "./stores";

// ── Metadata ──

const META = Symbol("paintbrush");

/** Lazy server reference — set after Bun.serve() returns. */
export const serverRef: { current: any } = { current: null };

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
}

interface ClassMeta {
  resource?: ResourceMeta;
  fields: FieldMeta[];
  routes: RouteMeta[];
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
    // Attach metadata to class since Bun doesn't auto-set Symbol.metadata
    (target as any)[META] = meta;
  };
}

// ── @GET, @POST, @PUT, @DELETE decorators ──

function routeDecorator(method: string, path: string) {
  return function <This>(
    target: (this: This, req: any) => Response | Promise<Response>,
    context: ClassMethodDecoratorContext<This>,
  ): void {
    getMeta(context.metadata).routes.push({ method, path, handler: target });
  };
}

export function GET(path: string) { return routeDecorator("GET", path); }
export function POST(path: string) { return routeDecorator("POST", path); }
export function PUT(path: string) { return routeDecorator("PUT", path); }
export function DELETE(path: string) { return routeDecorator("DELETE", path); }

// ── Attach metadata for non-@Resource classes (e.g. custom route controllers) ──

function ensureMeta<T extends new (...args: any[]) => any>(
  target: T,
  context: ClassDecoratorContext<T>,
): void {
  (target as any)[META] = getMeta(context.metadata);
}

/** Class decorator to attach route metadata for controllers without @Resource */
export function Controller(
  target: new (...args: any[]) => any,
  context: ClassDecoratorContext,
): void {
  ensureMeta(target, context);
}

// ── buildRoutes ──

/**
 * Reads decorator metadata from classes and returns a plain route object
 * for Bun.serve(). Handles both @Resource classes (CRUD) and classes
 * with @GET/@POST etc. method decorators (custom endpoints).
 */
export function buildRoutes(...classes: (new (...args: any[]) => any)[]): RouteObject {
  const routes: RouteObject = {};

  for (const cls of classes) {
    const meta = (cls as any)[META] as ClassMeta | undefined;
    if (!meta) continue;

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
        async GET() {
          return Response.json(await store.read());
        },
        async POST(req: Request) {
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
          if (notify && serverRef.current) {
            serverRef.current.publish(notify, JSON.stringify({ resource: notify, action: "create", item }));
          }
          return Response.json(item, { status: 201 });
        },
      };

      routes[`${basePath}/:id`] = {
        async GET(req: any) {
          const items = await store.read();
          const item = items.find((i: any) => i.id === req.params.id);
          return item
            ? Response.json(item)
            : Response.json({ error: "Not found" }, { status: 404 });
        },
        async PUT(req: any) {
          const items = await store.read();
          const idx = items.findIndex((i: any) => i.id === req.params.id);
          if (idx === -1) return Response.json({ error: "Not found" }, { status: 404 });
          const body = await req.json();
          for (const field of readonlyFields) delete body[field];
          items[idx] = { ...items[idx], ...body, id: req.params.id };
          await store.write(items);
          if (notify && serverRef.current) {
            serverRef.current.publish(notify, JSON.stringify({ resource: notify, action: "update", id: req.params.id, fields: body }));
          }
          return Response.json(items[idx]);
        },
        async DELETE(req: any) {
          const items = await store.read();
          const filtered = items.filter((i: any) => i.id !== req.params.id);
          if (filtered.length === items.length) {
            return Response.json({ error: "Not found" }, { status: 404 });
          }
          await store.write(filtered);
          if (notify && serverRef.current) {
            serverRef.current.publish(notify, JSON.stringify({ resource: notify, action: "delete", id: req.params.id }));
          }
          return new Response(null, { status: 204 });
        },
      };
    }

    // Custom method-decorated routes
    if (meta.routes.length > 0) {
      const instance = new cls();
      for (const route of meta.routes) {
        routes[route.path] ??= {};
        routes[route.path][route.method] = route.handler.bind(instance);
      }
    }
  }

  return routes;
}
