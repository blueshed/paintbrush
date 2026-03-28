/**
 * App — Client entry point. Routes and resources.
 *
 * The WebSocket connection is provided to all views via DI.
 * To add a view: import its component and add a route entry below.
 */
import { routes } from "@blueshed/railroad/routes";
import { provide } from "@blueshed/railroad/shared";
import { connectWs, WS } from "./lib/paintbrush-ws";
import { MessageView } from "./resources/message/message-view";
import { StatusView } from "./resources/status/status-view";

provide(WS, connectWs("/ws"));

const app = document.getElementById("app")!;

routes(app, {
  "/": () => <><MessageView /><StatusView /></>,
  "*": () => <p>Page not found!<br/><a href="#">&larr; home</a></p>,
});
