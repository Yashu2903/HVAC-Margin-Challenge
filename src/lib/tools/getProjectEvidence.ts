import { getProjectSignals } from "./getProjectSignals";
import { searchFieldNotes } from "./searchFieldNotes";

const RISK_KEYWORDS = ["rework", "redo", "waiting", "delay", "change order", "overtime", "late delivery", "late completion"];

export async function getProjectEvidence(projectId: string) {
  const signals = await getProjectSignals(projectId);

  const fieldNoteSnippets: { date: string; content: string }[] = [];
  for (const keyword of RISK_KEYWORDS) {
    const hits = await searchFieldNotes(projectId, keyword);
    for (const h of hits) {
      const snippet = (h.content ?? "").slice(0, 120);
      if (snippet && !fieldNoteSnippets.some((s) => s.content === snippet)) {
        fieldNoteSnippets.push({ date: h.date ?? "", content: snippet });
      }
    }
  }

  const formatDate = (d: string) => {
    if (!d) return "";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return d;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}`;
  };

  return {
    project_id: projectId,
    field_notes: fieldNoteSnippets.slice(0, 5).map((s) => `Field note (${formatDate(s.date)}): "${s.content}${s.content.length >= 120 ? "…" : ""}"`),
    rfi_subjects: signals.rfis.open_subjects.filter(Boolean),
    change_order_descriptions: signals.change_orders.pending_descriptions.filter(Boolean),
  };
}
