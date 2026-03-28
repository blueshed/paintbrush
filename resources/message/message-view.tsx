import { effect } from "@blueshed/railroad/signals";
import { openDoc } from "@lib/delta-doc";
import { toast } from "@lib/toast";
import type { Message } from "./message-api";

const message = openDoc<Message>("message");

export function MessageView() {
  let ta: HTMLTextAreaElement;

  effect(() => {
    const doc = message.data.get();
    if (doc && ta) ta.value = doc.message;
  });

  function save() {
    message.send([{ op: "replace", path: "/message", value: ta.value }]);
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
