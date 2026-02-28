import { navigate } from "./signals";

/** Escape HTML special characters. Safe for use in innerHTML templates. */
export function esc(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Generic 404 view with back-to-home link. */
export function notFoundView(root: HTMLElement): void {
  root.innerHTML = `
    <h1>404</h1>
    <p>Page not found.</p>
    <a class="back" id="back">&larr; Home</a>
  `;
  root.querySelector("#back")!.addEventListener("click", () => navigate("/"));
}
