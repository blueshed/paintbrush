/**
 * App — Client entry point. Hash router maps paths to view components.
 *
 * To add a view: import its component and add a route entry below.
 */
import { routes } from "@blueshed/railroad/routes";
import { MessageView } from "./resources/message/message-view";
import { StatusView } from "./resources/status/status-view";

const app = document.getElementById("app")!;

routes(app, {
  "/": () => <><MessageView /><StatusView /></>,
  "*": () => <p>Page not found!<br/><a href="#">&larr; home</a></p>,
});
