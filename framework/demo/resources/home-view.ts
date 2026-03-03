import { navigate } from "../../lib/signals";

export function homeView(root: HTMLElement): void {
  root.innerHTML = `
    <h1>Paintbrush</h1>
    <ul class="nav-list">
      <li class="nav-item" id="go-notes">Notes</li>
      <li class="nav-item" id="go-todos">Todos</li>
      <li class="nav-item" id="go-checklists">Checklists</li>
      <li class="nav-item" id="go-admin">Admin</li>
    </ul>
  `;
  root.querySelector("#go-notes")!.addEventListener("click", () => navigate("/notes"));
  root.querySelector("#go-todos")!.addEventListener("click", () => navigate("/todos"));
  root.querySelector("#go-checklists")!.addEventListener("click", () => navigate("/checklists"));
  root.querySelector("#go-admin")!.addEventListener("click", () => navigate("/admin"));
}
