/**
 * Shared — re-exports railroad's typed provide/inject,
 * adds tryInject (returns undefined instead of throwing),
 * and defines app-wide keys.
 */

export { key, provide, inject } from "@blueshed/railroad/shared";
export type { Key } from "@blueshed/railroad/shared";

import { key, inject } from "@blueshed/railroad/shared";
import type { Key } from "@blueshed/railroad/shared";
import type { Toast } from "./toast";

export function tryInject<T>(k: Key<T>): T | undefined {
  try {
    return inject(k);
  } catch {
    return undefined;
  }
}

// App-wide keys
export const WS = key<WebSocket>("ws");
export const TOAST = key<Toast>("toast");
export const SERVER = key<any>("server");
