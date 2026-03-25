/**
 * App — Client entry point. Wires up shared services and the hash router.
 *
 * Setup:
 *   1. Registers a reconnecting WebSocket as a shared service
 *   2. Declares the route table — each path maps to a component function
 *
 * To add a view: import its component and add a route entry below.
 */
import { routes } from "@blueshed/railroad/routes";
import { reconnectingWebSocket } from "./lib/reconnecting-ws";
import { provide, WS } from "./lib/shared";
import { MessageView } from "./resources/message/message-view";
import { StatusView } from "./resources/status/status-view";

const app = document.getElementById("app")!;
const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
provide(WS, reconnectingWebSocket(`${wsProto}//${location.host}/ws`));

routes(app, {
  "/": () => <><MessageView /><StatusView /></>,
  "*": () => <p>Page not found!<br/><a href="#">&larr; home</a></p>,
});
