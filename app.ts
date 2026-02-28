import { routes } from "./lib/signals";
import { reconnectingWebSocket } from "./lib/reconnecting-ws";
import { notFoundView } from "./lib/utils";
import { homeView } from "./resources/home-view";
import { noteListView, noteDetailView } from "./resources/notes/notes-views";
import { todoListView, todoDetailView } from "./resources/todos/todos-views";
import {
  checklistListView,
  checklistDetailView,
} from "./resources/checklists/checklists-views";
import { adminView } from "./resources/admin/admin-views";

const app = document.getElementById("app")!;
const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
const ws = reconnectingWebSocket(`${wsProto}//${location.host}/ws`);

routes(app, {
  "/": () => homeView(app),
  "/notes": () => noteListView(app),
  "/notes/:id": ({ id }) => noteDetailView(app, id),
  "/todos": () => todoListView(app, ws),
  "/todos/:id": ({ id }) => todoDetailView(app, id),
  "/checklists": () => checklistListView(app, ws),
  "/checklists/:id": ({ id }) => checklistDetailView(app, id),
  "/admin": () => adminView(app),
  "*": () => notFoundView(app),
});
