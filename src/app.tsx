/**
 * App — client entry point: the routes, each drawn from resources.
 *
 * To add a page: import its view and add a route entry below.
 */
import { routes } from "@blueshed/railroad";
import { MessageView } from "./resources/message/view";
import { StatusView } from "./resources/status/view";

routes(document.getElementById("app")!, {
  "/": () => (
    <>
      <MessageView />
      <StatusView />
    </>
  ),
  "*": () => (
    <p>
      Page not found!
      <br />
      <a href="#">&larr; home</a>
    </p>
  ),
});
