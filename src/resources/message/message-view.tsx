import { signal, when } from "@blueshed/railroad";
import { toast } from "../toast";
import { load, message, save } from "./message";

export function MessageView() {
  const text = signal(message.peek()?.message ?? "");
  const failed = signal(false);

  load().then(
    () => text.set(message.peek()!.message),
    () => failed.set(true),
  );

  // Say "Saved" only once the server has said so
  async function onsave() {
    try {
      await save(text.peek());
      toast("Saved");
    } catch {
      toast("Not saved", "alert");
    }
  }

  return (
    <>
      <h1>Paintbrush</h1>
      {when(failed, () => <p class="help">The message could not be loaded.</p>)}
      <textarea
        value={text}
        oninput={(e: Event) => text.set((e.currentTarget as HTMLTextAreaElement).value)}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter" && e.metaKey) void onsave();
        }}
      ></textarea>
      <div class="toolbar">
        <button class="primary" onclick={onsave}>Save</button>
      </div>
      <p class="help">Edit the message above and hit <strong>Save</strong> to persist it.</p>
    </>
  );
}
