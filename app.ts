import { routes, navigate } from "./lib/signals";
import { noteListView, noteDetailView } from "./resources/notes-views";
import { todoListView, todoDetailView } from "./resources/todos-views";

const app = document.getElementById("app")!;
const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${wsProto}//${location.host}/ws`);

routes(app, {
  "/": () => homeView(app),
  "/notes": () => noteListView(app),
  "/notes/:id": ({ id }) => noteDetailView(app, id),
  "/todos": () => todoListView(app, ws),
  "/todos/:id": ({ id }) => todoDetailView(app, id),
  "*": () => notFoundView(app),
});

function homeView(root: HTMLElement): void {
  root.innerHTML = `
    <h1>Paintbrush</h1>
    <ul class="nav-list">
      <li class="nav-item" id="go-notes">Notes</li>
      <li class="nav-item" id="go-todos">Todos</li>
    </ul>
  `;
  root.querySelector("#go-notes")!.addEventListener("click", () => navigate("/notes"));
  root.querySelector("#go-todos")!.addEventListener("click", () => navigate("/todos"));
}

function notFoundView(root: HTMLElement): void {
  root.innerHTML = `
    <h1>404</h1>
    <p>Page not found.</p>
    <a class="back" id="back">&larr; Home</a>
  `;
  root.querySelector("#back")!.addEventListener("click", () => navigate("/"));
}
