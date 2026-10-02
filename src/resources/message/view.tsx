import { signal, when } from "@blueshed/railroad";
import { toast } from "../toast";
import { message } from "./store";

export function MessageView() {
  const text = signal(message.data.peek()?.message ?? "");

  message.load().then(() => {
    const loaded = message.data.peek();
    if (loaded) text.set(loaded.message);
  });

  // Say "Saved" only once the server has said so
  async function onsave() {
    try {
      await message.save({ message: text.peek() });
      toast("Saved");
    } catch {
      toast("Not saved", "alert");
    }
  }

  return (
    <>
      <h1>Message</h1>
      {when(message.failed, () => <p class="help">The message could not be loaded.</p>)}
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
