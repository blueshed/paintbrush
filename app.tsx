/**
 * App — Client entry point. Routes and resources.
 *
 * The hub connects to the WebSocket and is provided to all views.
 * To add a view: import its component and add a route entry below.
 */
import { routes } from "@blueshed/railroad/routes";
import { provide } from "@blueshed/railroad/shared";
import { createDeltaClient, HUB } from "./lib/delta-doc";
import { MessageView } from "./resources/message/message-view";
import { StatusView } from "./resources/status/status-view";

provide(HUB, createDeltaClient("/ws"));

const app = document.getElementById("app")!;

routes(app, {
  "/": () => <><MessageView /><StatusView /></>,
  "*": () => <p>Page not found!<br/><a href="#">&larr; home</a></p>,
});
