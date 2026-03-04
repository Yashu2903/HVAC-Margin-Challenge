import { getProjectFinancials} from "./getProjectFinancials";
import { clamp } from "@/lib/metrics/projectMath";
import { getProjectSignals } from "./getProjectSignals";

export async function getProjectRiskScore(projectId: string) {

    const financials = await getProjectFinancials(projectId);
    const signals = await getProjectSignals(projectId);

    let score = 0;

    const reasons: string[] = [];

    if (financials.cost_over_earned > 0) {
        score += 4;
        reasons.push("Cost is exceeding earned value (true margin erosion risk).");
    }
    if (financials.billing_lag > 0) {
        score += 2;
        reasons.push("Billing is lagging earned value (cash + timing risk).");
    }

    if (signals.change_orders.pending_value > 0) {
        score += 3;
        reasons.push("Pending change orders represent unsecured revenue.");
    }

    if (signals.rfis.open > 5){
        score += 2;
        reasons.push("High open RFI volume suggests design/coordination instability.");
    }

    score = clamp(score, 0, 10);

    const riskBand = score >= 8 ? "High" : score >= 5 ? "Medium" : "Low";


    return {
        project_id: projectId,
        risk_score: score,
        risk_band: riskBand,
        reasons,
        financials,
        signals,
    };
}    