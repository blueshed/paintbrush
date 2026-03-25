/**
 * Shared — re-exports railroad's DI primitives
 * and defines app-wide keys and helpers.
 */

export { key, provide, inject, tryInject } from "@blueshed/railroad/shared";
export type { Key } from "@blueshed/railroad/shared";

import { key } from "@blueshed/railroad/shared";
import { tryInject } from "@blueshed/railroad/shared";

// App-wide keys
export const WS = key<WebSocket>("ws");
export const SERVER = key<any>("server");

/** Subscribe to a WS resource topic; returns a cleanup function. */
export function connectResource(resource: string, onMessage: (msg: any) => void) {
  const ws = tryInject(WS);
  if (!ws) return () => {};
  ws.send(JSON.stringify({ action: "opendoc", resource }));
  const handler = (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.resource === resource) onMessage(msg);
    } catch {}
  };
  ws.addEventListener("message", handler);
  return () => {
    ws.removeEventListener("message", handler);
    ws.send(JSON.stringify({ action: "closedoc", resource }));
  };
}
