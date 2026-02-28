/**
 * Shared resource registry — named provide/inject for cross-cutting services.
 *
 * Usage:
 *   provide("server", server);          // register after creation
 *   const srv = inject<Server>("server"); // retrieve (throws if missing)
 *   const srv = tryInject<Server>("server"); // retrieve (undefined if missing)
 */

const _resources = new Map<string, any>();

export function provide<T>(name: string, value: T): void {
  _resources.set(name, value);
}

export function inject<T>(name: string): T {
  const v = _resources.get(name);
  if (v === undefined) throw new Error(`"${name}" not provided`);
  return v as T;
}

export function tryInject<T>(name: string): T | undefined {
  return _resources.get(name) as T | undefined;
}
