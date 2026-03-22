/**
 * Shared — re-exports railroad's typed provide/inject,
 * adds tryInject, and defines framework-wide keys.
 */

export { key, provide, inject } from "@blueshed/railroad/shared";
export type { Key } from "@blueshed/railroad/shared";

import { key, inject } from "@blueshed/railroad/shared";
import type { Key } from "@blueshed/railroad/shared";

export function tryInject<T>(k: Key<T>): T | undefined {
  try {
    return inject(k);
  } catch {
    return undefined;
  }
}

// Framework keys
export const SERVER = key<any>("server");
export const DB = key<any>("db");
export const SESSIONS = key<any>("sessions");
export const WS = key<WebSocket>("ws");
