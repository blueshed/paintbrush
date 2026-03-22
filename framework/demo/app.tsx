import { routes } from "@blueshed/railroad/routes";
import { reconnectingWebSocket } from "../../lib/reconnecting-ws";
import { provide, WS } from "../lib/shared";
import { NotFoundView } from "../lib/utils";
import { HomeView } from "./resources/home-view";
import { NoteListView, NoteDetailView } from "./resources/notes/notes-views";
import { TodoListView, TodoDetailView } from "./resources/todos/todos-views";
import { ChecklistListView, ChecklistDetailView } from "./resources/checklists/checklists-views";
import { AdminView } from "./resources/admin/admin-views";

const app = document.getElementById("app")!;
const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
provide(WS, reconnectingWebSocket(`${wsProto}//${location.host}/ws`));

routes(app, {
  "/": () => <HomeView />,
  "/notes": () => <NoteListView />,
  "/notes/:id": ({ id }) => <NoteDetailView id={id} />,
  "/todos": () => <TodoListView />,
  "/todos/:id": ({ id }) => <TodoDetailView id={id} />,
  "/checklists": () => <ChecklistListView />,
  "/checklists/:id": ({ id }) => <ChecklistDetailView id={id} />,
  "/admin": () => <AdminView />,
  "*": () => <NotFoundView />,
});
