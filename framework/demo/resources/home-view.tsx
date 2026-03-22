import { navigate } from "@blueshed/railroad/routes";

export function HomeView() {
  return (
    <>
      <h1>Paintbrush</h1>
      <ul class="nav-list">
        <li class="nav-item" onclick={() => navigate("/notes")}>Notes</li>
        <li class="nav-item" onclick={() => navigate("/todos")}>Todos</li>
        <li class="nav-item" onclick={() => navigate("/checklists")}>Checklists</li>
        <li class="nav-item" onclick={() => navigate("/admin")}>Admin</li>
      </ul>
    </>
  );
}
