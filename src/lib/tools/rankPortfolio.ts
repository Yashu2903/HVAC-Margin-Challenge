import { listProjects } from "./listProjects";
import { getProjectRiskScore } from "./getProjectRiskScore";


export async function rankPortfolio() {
    const projects = await listProjects();

    const scored = [];

    for (const project of projects) {
        scored.push(await getProjectRiskScore(project.project_id));
    }

    scored.sort((a, b) => b.risk_score - a.risk_score);

    console.log("projects ranked:", scored.length);

    return {

        total_projects: projects.length,
        ranked: scored.map((s) => ({
            project_id: s.project_id,
            risk_score: s.risk_score,
            risk_band: s.risk_band,
            top_reasons: s.reasons.slice(0, 3),
            cost_over_earned: s.financials.cost_over_earned,
            recoverable_exposure: s.financials.recoverable_exposure,
            billing_lag: s.financials.billing_lag,
            pending_co_value: s.financials.pending_change_order_value,
            open_rfis: s.signals.rfis.open,
        })),
    };
}
