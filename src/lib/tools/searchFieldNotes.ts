import { loadCsv } from "../data/loadCsv";
import type { FieldNote } from "../data/types";

async function searchFieldNotes(projectId: string, query: string) {
  const notes = await loadCsv<FieldNote>("field_notes.csv");
  const normalizedQuery = query.toLowerCase().replace(/_/g, " ").trim();

  return notes
    .filter((note) => note.project_id === projectId)
    .filter((note) =>
      normalizedQuery ? (note.content ?? "").toLowerCase().includes(normalizedQuery) : false
    )
    .slice(0, 10)
    .map((note) => ({
      date: note.date,
      content: note.content,
    }));
}

export { searchFieldNotes };
