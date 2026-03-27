import { effect } from "@blueshed/railroad/signals";
import { createClientStore } from "@lib/delta-doc";
import { toast } from "@lib/toast";

const { data, sendDelta, init } = createClientStore<{ message: string }>({
  apiPath: "/api/data",
  wsPath: "/ws",
});

export function MessageView() {
  let ta: HTMLTextAreaElement;

  effect(() => {
    const msg = data.get();
    if (msg && ta) ta.value = msg.message;
  });
  init();

  async function save() {
    await sendDelta([{ op: "replace", path: "/message", value: ta.value }]);
    toast("Saved");
  }

  return (
    <>
      <h1 style="display:flex;justify-content:space-between;align-items:baseline">
        <span>Paintbrush</span>
        <img src="/logo.png" alt="" style="height:2rem" />
      </h1>
      <textarea ref={(el: HTMLTextAreaElement) => { ta = el; }} onkeydown={(e: KeyboardEvent) => {
        if (e.key === "Enter" && e.metaKey) save();
      }}></textarea>
      <div class="toolbar">
        <button class="primary" onclick={save}>Save</button>
      </div>
      <p class="help">Edit the message above and hit <strong>Save</strong> to persist it.</p>
    </>
  );
}
