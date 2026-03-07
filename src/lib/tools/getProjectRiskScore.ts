import { getProjectFinancials } from "./getProjectFinancials";
import { clamp } from "@/lib/metrics/projectMath";
import { getProjectSignals } from "./getProjectSignals";
import { getProjectEvidence } from "./getProjectEvidence";

const THRESHOLD_COST_OVER_EARNED = 250_000;
const THRESHOLD_BILLING_LAG = 200_000;
const THRESHOLD_PENDING_CO = 100_000;
const THRESHOLD_OPEN_RFIS = 10;

export async function getProjectRiskScore(projectId: string) {
  const financials = await getProjectFinancials(projectId);
  const signals = await getProjectSignals(projectId);
  const evidence = await getProjectEvidence(projectId);

  let score = 0;
  const reasons: string[] = [];

  if (financials.cost_over_earned > THRESHOLD_COST_OVER_EARNED) {
    score += 3;
    reasons.push("Cost is exceeding earned value (true margin erosion risk).");
  }
  if (financials.billing_lag > THRESHOLD_BILLING_LAG) {
    score += 2;
    reasons.push("Billing is lagging earned value (cash + timing risk).");
  }
  if (signals.change_orders.pending_value > THRESHOLD_PENDING_CO) {
    score += 2;
    reasons.push("Pending change orders represent unsecured revenue.");
  }
  if (signals.rfis.open > THRESHOLD_OPEN_RFIS) {
    score += 1;
    reasons.push("High open RFI volume suggests design/coordination instability.");
  }
  const hasFieldNoteRisk = evidence.field_notes.length > 0;
  if (hasFieldNoteRisk) {
    score += 2;
    reasons.push("Field notes contain risk-related keywords.");
  }

  score = clamp(score, 0, 10);

  const riskBand = score >= 7 ? "High" : score >= 4 ? "Medium" : "Low";

  return {
    project_id: projectId,
    risk_score: score,
    risk_band: riskBand,
    reasons,
    financials,
    signals,
    evidence,
  };
}    