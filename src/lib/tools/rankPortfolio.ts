import { listProjects } from "./listProjects";
import { getProjectRiskScore } from "./getProjectRiskScore";

const BILLING_LAG_PATTERN_THRESHOLD = 100_000;

export async function rankPortfolio() {
  const projects = await listProjects();
  const projectMap = new Map(projects.map((p) => [p.project_id, p]));

  const scored = [];
  for (const project of projects) {
    scored.push(await getProjectRiskScore(project.project_id));
  }

  const projectsWithBillingLag = scored.filter((s) => s.financials.billing_lag > BILLING_LAG_PATTERN_THRESHOLD);
  const systemicBillingIssue = projectsWithBillingLag.length >= 3;

  const patterns: string[] = [];
  if (systemicBillingIssue) {
    patterns.push(
      `Billing lag across ${projectsWithBillingLag.length} projects suggests invoicing delays across the portfolio.`
    );
  }

  const allLowRisk = scored.every((s) => s.risk_band === "Low");
  const overallStatus = allLowRisk
    ? "Healthy"
    : scored.some((s) => s.risk_band === "High")
      ? "At Risk"
      : "Mixed";

  const ranked = scored.map((s) => {
    const contractValue = s.financials.contract_value ?? projectMap.get(s.project_id)?.contract_value ?? 1;
    const portfolioRisk =
      s.risk_score +
      (contractValue > 0 ? s.financials.billing_lag / contractValue : 0) +
      (contractValue > 0 ? s.financials.pending_change_order_value / contractValue : 0);
    return {
      project_id: s.project_id,
      risk_score: s.risk_score,
      risk_band: s.risk_band,
      portfolio_risk_index: Math.round(portfolioRisk * 100) / 100,
      top_reasons: s.reasons.slice(0, 3),
      cost_over_earned: s.financials.cost_over_earned,
      recoverable_exposure: s.financials.recoverable_exposure,
      billing_lag: s.financials.billing_lag,
      pending_co_value: s.financials.pending_change_order_value,
      open_rfis: s.signals.rfis.open,
      contract_value: s.financials.contract_value,
      earned_value: s.financials.earned_value,
      total_cost: s.financials.total_cost,
      margin: s.financials.margin,
      margin_pct: s.financials.margin_pct,
      percent_complete: s.financials.percent_complete,
    };
  });

  ranked.sort((a, b) => b.portfolio_risk_index - a.portfolio_risk_index);

  return {
    total_projects: projects.length,
    overall_status: overallStatus,
    all_low_risk: allLowRisk,
    patterns,
    ranked,
  };
}
