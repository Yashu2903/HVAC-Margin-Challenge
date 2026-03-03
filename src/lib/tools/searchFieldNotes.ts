import { loadCsv } from "../data/loadCsv";
import type { FieldNote } from "../data/types";

async function searchFieldNotes(projectId: string, query: string) {
  const notes = await loadCsv<FieldNote>("field_notes.csv");
  const queryWords = query.toLowerCase().split(/\s+/);

  return notes
    .filter((note) => note.project_id === projectId)
    .filter((note) =>
      note.content.toLowerCase().includes(queryWords.join(" "))
    )
    .slice(0, 10)
    .map((note) => ({
      date: note.date,
      content: note.content,
    }));
}

export { searchFieldNotes };
