/**
 * Routes — Hash-based client router built on signals
 *
 * API:
 *   routes(target, table)   — declarative hash router, swaps target content
 *   route<T>(pattern)       — reactive route: Signal<T | null>, null when unmatched
 *   navigate(path)          — set location.hash programmatically
 *   matchRoute(pattern, path) — pure pattern matcher, returns params or null
 *
 * routes(target, table) is a declarative router — Bun.serve style:
 *   routes(app, {
 *     "/":          () => "<x-counter></x-counter>",
 *     "/site/:id":  ({ id }) => siteDetail(app, id),
 *   });
 *
 * Handlers may return a value to control rendering:
 *   - Node:     appended to target (web components)
 *   - string:   used as target.innerHTML
 *   - function: stored as dispose callback
 *   - void:     handler manages the DOM itself
 */

import { Signal, computed, effect } from "./signals";
import type { Dispose } from "./signals";

let hashSignal: Signal<string> | null = null;

function getHash(): Signal<string> {
  if (!hashSignal) {
    hashSignal = new Signal(location.hash.slice(1) || "/");
    window.addEventListener("hashchange", () => {
      hashSignal!.set(location.hash.slice(1) || "/");
    });
  }
  return hashSignal;
}

export function matchRoute(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const pp = pattern.split("/");
  const hp = path.split("/");
  if (pp.length !== hp.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i]!.startsWith(":")) {
      try {
        params[pp[i]!.slice(1)] = decodeURIComponent(hp[i]!);
      } catch {
        return null;
      }
    } else if (pp[i] !== hp[i]) return null;
  }
  return params;
}

export function route<
  T extends Record<string, string> = Record<string, string>,
>(pattern: string): Signal<T | null> {
  const hash = getHash();
  return computed(() => matchRoute(pattern, hash.get()) as T | null);
}

export function navigate(path: string): void {
  location.hash = path;
}

type RouteHandler = (
  params: Record<string, string>,
) => void | string | Node | Dispose;

export function routes(
  target: HTMLElement,
  table: Record<string, RouteHandler>,
): Dispose {
  const hash = getHash();
  let activePattern: string | null = null;
  let activeDispose: Dispose | null = null;

  function teardown() {
    if (activeDispose) activeDispose();
    activeDispose = null;
    activePattern = null;
    target.innerHTML = "";
  }

  function apply(result: ReturnType<RouteHandler>) {
    if (result instanceof Node) {
      target.appendChild(result);
    } else if (typeof result === "string") {
      target.innerHTML = result;
    } else if (typeof result === "function") {
      activeDispose = result;
    }
  }

  return effect(() => {
    const path = hash.get();
    for (const [pattern, handler] of Object.entries(table)) {
      const params = matchRoute(pattern, path);
      if (params) {
        if (pattern === activePattern) return; // same route, nothing to do
        teardown();
        activePattern = pattern;
        apply(handler(params));
        return;
      }
    }
    // No match — try fallback "*" handler, otherwise clear
    if (table["*"]) {
      if (activePattern !== "*") {
        teardown();
        activePattern = "*";
        apply(table["*"]({}));
      }
      return;
    }
    teardown();
  });
}
