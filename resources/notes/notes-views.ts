import { navigate, type Dispose } from "../../lib/signals";
import { esc } from "../../lib/utils";
import { loadNotes, createNote, loadNote, saveNote, deleteNote } from "./notes";

export function noteListView(root: HTMLElement): Dispose | void {
  let cancelled = false;
  loadNotes().then((notes) => {
    if (cancelled) return;
    if (notes.length === 0) {
      root.innerHTML = `
        <a class="back" id="back">&larr; Home</a>
        <h1>Notes</h1>
        <div class="toolbar"><button class="primary" id="add">New Note</button></div>
        <div class="empty">No notes yet.</div>
      `;
    } else {
      root.innerHTML = `
        <a class="back" id="back">&larr; Home</a>
        <h1>Notes</h1>
        <div class="toolbar"><button class="primary" id="add">New Note</button></div>
        <ul class="note-list">
          ${notes.map((n) => `
            <li class="note-item" data-id="${esc(n.id)}">
              <h2>${esc(n.title)}</h2>
              <p>${esc(n.body).slice(0, 100) || "No content"}</p>
            </li>
          `).join("")}
        </ul>
      `;
    }

    root.querySelector("#back")!.addEventListener("click", () => navigate("/"));
    root.querySelector("#add")!.addEventListener("click", async () => {
      const note = await createNote({ title: "Untitled" });
      navigate(`/notes/${note.id}`);
    });

    for (const item of root.querySelectorAll(".note-item")) {
      item.addEventListener("click", () => {
        navigate(`/notes/${(item as HTMLElement).dataset.id}`);
      });
    }
  });
  return () => { cancelled = true; };
}

export function noteDetailView(root: HTMLElement, id: string): Dispose | void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  loadNote(id).then((note) => {
    if (cancelled) return;
    if (!note) {
      root.innerHTML = `<div class="empty">Note not found.</div>`;
      return;
    }

    root.innerHTML = `
      <a class="back" id="back">&larr; All notes</a>
      <div class="form-group">
        <label>Title</label>
        <input id="title" value="${esc(note.title)}">
      </div>
      <div class="form-group">
        <label>Body</label>
        <textarea id="body">${esc(note.body)}</textarea>
      </div>
      <div class="toolbar">
        <button class="danger" id="del">Delete</button>
      </div>
      <div class="meta">Created: ${note.createdAt || "—"}</div>
    `;

    root.querySelector("#back")!.addEventListener("click", () => navigate("/notes"));

    function autosave() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const title = (root.querySelector("#title") as HTMLInputElement).value;
        const body = (root.querySelector("#body") as HTMLTextAreaElement).value;
        saveNote({ ...note!, title, body });
      }, 400);
    }

    root.querySelector("#title")!.addEventListener("input", autosave);
    root.querySelector("#title")!.addEventListener("keydown", async (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        const title = (root.querySelector("#title") as HTMLInputElement).value;
        const body = (root.querySelector("#body") as HTMLTextAreaElement).value;
        await saveNote({ ...note!, title, body });
        navigate("/notes");
      }
    });
    root.querySelector("#body")!.addEventListener("input", autosave);

    root.querySelector("#del")!.addEventListener("click", async () => {
      await deleteNote(note!.id);
      navigate("/notes");
    });
  });

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
