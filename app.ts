/**
 * App — Client entry point. Wires up shared services and the hash router.
 *
 * Setup:
 *   1. Registers a reconnecting WebSocket and toast as shared services
 *   2. Imports web component definitions (side-effect imports)
 *   3. Declares the route table — each path maps to HTML or a component
 *
 * To add a view: import its component file and add a route entry below.
 */
import { routes } from "./lib/routes";
import { reconnectingWebSocket } from "./lib/reconnecting-ws";
import { provide } from "./lib/shared";
import { initToast } from "./lib/toast";
import "./resources/message/message-view";
import "./resources/status/status-view";

const app = document.getElementById("app")!;
const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
provide("ws", reconnectingWebSocket(`${wsProto}//${location.host}/ws`));
provide("toast", initToast());

routes(app, {
  "/": () => "<message-view></message-view><status-view></status-view>",
  "*": () => `<p>Page not found!<br/><a href="#">&larr; home</a></p>`,
});
