import { routes } from "@blueshed/railroad/routes";
import { signal } from "@blueshed/railroad/signals";
import { when } from "@blueshed/railroad";
import { NotFoundView } from "../lib/utils";

const app = document.getElementById("app")!;

function HomeView() {
  const msg = signal("");
  let ta: HTMLTextAreaElement;

  fetch("/api/message").then(r => r.json()).then(d => msg.set(d.message));

  return when(
    () => msg.get(),
    () => (
      <>
        <h1>Paintbrush</h1>
        <textarea ref={(el: HTMLTextAreaElement) => { ta = el; ta.value = msg.peek(); }}></textarea>
        <div class="toolbar">
          <button class="primary" onclick={async () => {
            await fetch("/api/message", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: ta.value }),
            });
          }}>Save</button>
        </div>
      </>
    ),
  );
}

routes(app, {
  "/": () => <HomeView />,
  "*": () => <NotFoundView />,
});
