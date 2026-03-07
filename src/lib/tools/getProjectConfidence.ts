import {getProjectFinancials} from "./getProjectFinancials";
import {getProjectSignals} from "./getProjectSignals";
import { searchFieldNotes } from "./searchFieldNotes";

export async function getProjectConfidence(projectId: string) {

    const financials = await getProjectFinancials(projectId);
    const signals = await getProjectSignals(projectId);

    const keywords = ["rework", "redo", "waiting", "delay", "change_order", "ot", "overtime", "late", "late delivery", "late completion", "late start", "late finish", "late delivery", "late completion", "late start", "late finish"];

    let evidence = 0;

    for (const keyword of keywords) {
        const hits = await searchFieldNotes(projectId, keyword);
        evidence += hits.length;
    }

    let points = 0;

    if (financials.cost_over_earned > 100_000) points += 2;
    if (signals.change_orders.pending_value > 100_000) points += 2;
    if (signals.rfis.cost_impact > 0) points += 1;
    if (signals.rfis.open > 5) points += 1;
    if (financials.billing_lag > 50_000) points += 1;
    if (evidence > 5) points += 2;

    const confidence = points >= 7 ? "High" : points >= 4 ? "Medium" : "Low";

    return {
        projectId: projectId,
        confidence,
        confidence_points: points,
        evidence: evidence,
    };
}