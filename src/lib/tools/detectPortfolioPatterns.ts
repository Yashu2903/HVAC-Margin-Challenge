import { rankPortfolio } from "./rankPortfolio";

const BILLING_LAG_THRESHOLD = 100_000;
const PENDING_CO_THRESHOLD = 100_000;
const COST_OVER_EARNED_THRESHOLD = 250_000;
const OPEN_RFIS_THRESHOLD = 10;
const MARGIN_PCT_WARNING = 0.1; // < 10% margin
const MIN_PROJECTS_FOR_PATTERN = 2;

type PatternFinding = {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  affected_project_ids: string[];
  affected_count: number;
  total_value_at_risk?: number;
  recommended_action: string;
};

export async function detectPortfolioPatterns() {
  const portfolio = await rankPortfolio();
  const projects = portfolio.ranked;
  const findings: PatternFinding[] = [];

  // 1. Systemic billing lag
  const billingLagProjects = projects.filter((p) => (p.billing_lag ?? 0) > BILLING_LAG_THRESHOLD);
  if (billingLagProjects.length >= MIN_PROJECTS_FOR_PATTERN) {
    const totalLag = billingLagProjects.reduce((sum, p) => sum + (p.billing_lag ?? 0), 0);
    findings.push({
      type: "systemic_billing_lag",
      severity: billingLagProjects.length >= 3 ? "high" : "medium",
      description: `Billing lag across ${billingLagProjects.length} of ${projects.length} projects suggests portfolio-wide invoicing delays.`,
      affected_project_ids: billingLagProjects.map((p) => p.project_id),
      affected_count: billingLagProjects.length,
      total_value_at_risk: totalLag,
      recommended_action: "Review accounts receivable process; consider accelerating pay application submissions.",
    });
  }

  // 2. High RFI volume (design/coordination instability)
  const highRFIProjects = projects.filter((p) => (p.open_rfis ?? 0) > OPEN_RFIS_THRESHOLD);
  if (highRFIProjects.length >= MIN_PROJECTS_FOR_PATTERN) {
    findings.push({
      type: "design_coordination_instability",
      severity: highRFIProjects.length >= 3 ? "high" : "medium",
      description: `High open RFI volume in ${highRFIProjects.length} projects suggests design or coordination instability across the portfolio.`,
      affected_project_ids: highRFIProjects.map((p) => p.project_id),
      affected_count: highRFIProjects.length,
      recommended_action: "Escalate to engineering/design team; consider design review process improvements.",
    });
  }

  // 3. Pending change order concentration (scope drift)
  const pendingCOProjects = projects.filter((p) => (p.pending_co_value ?? 0) > PENDING_CO_THRESHOLD);
  if (pendingCOProjects.length >= MIN_PROJECTS_FOR_PATTERN) {
    const totalPending = pendingCOProjects.reduce((sum, p) => sum + (p.pending_co_value ?? 0), 0);
    findings.push({
      type: "scope_drift",
      severity: totalPending > 500_000 ? "high" : "medium",
      description: `Large pending change orders in ${pendingCOProjects.length} projects indicate scope drift risk across the portfolio.`,
      affected_project_ids: pendingCOProjects.map((p) => p.project_id),
      affected_count: pendingCOProjects.length,
      total_value_at_risk: totalPending,
      recommended_action: "Prioritize CO approvals; track aging of pending change orders.",
    });
  }

  // 4. Margin erosion (cost over earned)
  const marginErosionProjects = projects.filter((p) => (p.cost_over_earned ?? 0) > COST_OVER_EARNED_THRESHOLD);
  if (marginErosionProjects.length >= MIN_PROJECTS_FOR_PATTERN) {
    const totalOverrun = marginErosionProjects.reduce((sum, p) => sum + (p.cost_over_earned ?? 0), 0);
    findings.push({
      type: "margin_erosion",
      severity: totalOverrun > 1_000_000 ? "high" : "medium",
      description: `Cost exceeding earned value in ${marginErosionProjects.length} projects suggests portfolio-wide margin pressure.`,
      affected_project_ids: marginErosionProjects.map((p) => p.project_id),
      affected_count: marginErosionProjects.length,
      total_value_at_risk: totalOverrun,
      recommended_action: "Conduct project-level cost reviews; identify common cost drivers.",
    });
  }

  // 5. Thin margin concentration (low margin_pct across multiple projects)
  const thinMarginProjects = projects.filter((p) => {
    const pct = p.margin_pct ?? 0;
    return pct >= 0 && pct < MARGIN_PCT_WARNING;
  });
  if (thinMarginProjects.length >= MIN_PROJECTS_FOR_PATTERN) {
    findings.push({
      type: "thin_margin_concentration",
      severity: "medium",
      description: `Low margin (<${MARGIN_PCT_WARNING * 100}%) in ${thinMarginProjects.length} projects indicates profitability risk concentration.`,
      affected_project_ids: thinMarginProjects.map((p) => p.project_id),
      affected_count: thinMarginProjects.length,
      recommended_action: "Review bid assumptions and cost controls on thin-margin projects.",
    });
  }

  // 6. Shared risk driver (same top reason across 2+ projects)
  const reasonCounts = new Map<string, string[]>();
  for (const p of projects) {
    const topReason = (p as { top_reasons?: string[] }).top_reasons?.[0];
    if (topReason) {
      const list = reasonCounts.get(topReason) ?? [];
      list.push(p.project_id);
      reasonCounts.set(topReason, list);
    }
  }
  for (const [reason, projectIds] of reasonCounts) {
    if (projectIds.length >= MIN_PROJECTS_FOR_PATTERN) {
      findings.push({
        type: "shared_risk_driver",
        severity: projectIds.length >= 3 ? "high" : "medium",
        description: `"${reason}" is the top risk in ${projectIds.length} projects—suggests a common root cause.`,
        affected_project_ids: projectIds,
        affected_count: projectIds.length,
        recommended_action: "Investigate root cause; consider portfolio-wide mitigation.",
      });
    }
  }

  // 7. Portfolio concentration (high risk in majority)
  const highRiskCount = projects.filter((p) => (p as { risk_band?: string }).risk_band === "High").length;
  const mediumRiskCount = projects.filter((p) => (p as { risk_band?: string }).risk_band === "Medium").length;
  if (highRiskCount >= 2 || highRiskCount + mediumRiskCount >= projects.length - 1) {
    findings.push({
      type: "portfolio_concentration",
      severity: highRiskCount >= 2 ? "high" : "medium",
      description: `${highRiskCount} High-risk and ${mediumRiskCount} Medium-risk projects—portfolio risk is concentrated, not isolated.`,
      affected_project_ids: projects.map((p) => p.project_id),
      affected_count: projects.length,
      recommended_action: "Executive review; consider resource reallocation or portfolio rebalancing.",
    });
  }

  const patterns = findings.length > 0
    ? findings.map((f) => `${f.description} [Affected: ${f.affected_project_ids.join(", ")}] → ${f.recommended_action}`)
    : ["No systemic cross-project patterns detected. Risks appear project-specific."];

  return {
    total_projects: projects.length,
    patterns,
    findings: findings.map(({ type, severity, description, affected_project_ids, affected_count, total_value_at_risk, recommended_action }) => ({
      type,
      severity,
      description,
      affected_project_ids,
      affected_count,
      total_value_at_risk: total_value_at_risk ?? undefined,
      recommended_action,
    })),
    summary: findings.length > 0
      ? `${findings.length} cross-project pattern(s) detected. Review findings for portfolio-level actions.`
      : "Portfolio risks appear isolated; no systemic patterns.",
  };
}