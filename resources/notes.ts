import type { Note } from "./notes-api";

export type { Note };

export async function loadNotes(): Promise<Note[]> {
  const res = await fetch("/api/notes");
  if (!res.ok) return [];
  return res.json();
}

export async function loadNote(id: string): Promise<Note | null> {
  const res = await fetch(`/api/notes/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createNote(note: { title: string; body?: string }): Promise<Note> {
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
  return res.json();
}

export async function saveNote(note: Partial<Note> & { id: string }): Promise<Note> {
  const res = await fetch(`/api/notes/${note.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
  return res.json();
}

export async function deleteNote(id: string): Promise<void> {
  await fetch(`/api/notes/${id}`, { method: "DELETE" });
}
