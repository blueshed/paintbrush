import { navigate } from "@blueshed/railroad/routes";

/** Generic 404 view — JSX component. */
export function NotFoundView() {
  return (
    <>
      <h1>404</h1>
      <p>Page not found.</p>
      <a class="back" onclick={() => navigate("/")}>← Home</a>
    </>
  );
}
