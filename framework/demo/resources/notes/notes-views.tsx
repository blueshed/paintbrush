import { navigate } from "@blueshed/railroad/routes";
import { signal, effect } from "@blueshed/railroad/signals";
import { when } from "@blueshed/railroad";
import { loadNotes, createNote, loadNote, saveNote, deleteNote } from "./notes";
import type { Note } from "./notes";

export function NoteListView() {
  const notes = signal<Note[] | undefined>(undefined);
  loadNotes().then((n) => notes.set(n));

  return (
    <>
      <a class="back" onclick={() => navigate("/")}>← Home</a>
      <h1>Notes</h1>
      <div class="toolbar">
        <button class="primary" onclick={async () => {
          const note = await createNote({ title: "Untitled" });
          navigate(`/notes/${note.id}`);
        }}>New Note</button>
      </div>
      {when(
        () => notes.get() !== undefined,
        () => {
          const items = notes.get()!;
          if (items.length === 0) return <div class="empty">No notes yet.</div>;
          return (
            <ul class="note-list">
              {items.map((n) => (
                <li class="note-item" onclick={() => navigate(`/notes/${n.id}`)}>
                  <h2>{n.title}</h2>
                  <p>{(n.body ?? "").slice(0, 100) || "No content"}</p>
                </li>
              ))}
            </ul>
          );
        },
      )}
    </>
  );
}

export function NoteDetailView({ id }: { id: string }) {
  const data = signal<Note | null | undefined>(undefined);
  let titleEl: HTMLInputElement;
  let bodyEl: HTMLTextAreaElement;
  let timer: ReturnType<typeof setTimeout> | null = null;

  loadNote(id).then((n) => data.set(n ?? null));

  effect(() => () => { if (timer) clearTimeout(timer); });

  return when(
    () => data.get() !== undefined,
    () => {
      const note = data.get();
      if (!note) return <div class="empty">Note not found.</div>;

      function autosave() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          saveNote({ id, title: titleEl.value, body: bodyEl.value });
        }, 400);
      }

      return (
        <>
          <a class="back" onclick={() => navigate("/notes")}>← All notes</a>
          <div class="form-group">
            <label>Title</label>
            <input value={note.title}
              ref={(el: HTMLInputElement) => { titleEl = el; }}
              oninput={autosave}
              onkeydown={async (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  await saveNote({ id, title: titleEl.value, body: bodyEl.value });
                  navigate("/notes");
                }
              }} />
          </div>
          <div class="form-group">
            <label>Body</label>
            <textarea ref={(el: HTMLTextAreaElement) => { bodyEl = el; }}
              oninput={autosave}>{note.body}</textarea>
          </div>
          <div class="toolbar">
            <button class="danger" onclick={async () => {
              await deleteNote(id);
              navigate("/notes");
            }}>Delete</button>
          </div>
          <div class="meta">Created: {note.createdAt || "—"}</div>
        </>
      );
    },
  );
}
