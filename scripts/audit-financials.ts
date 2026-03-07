/**
 * One-project manual audit script.
 * Run from hvac-agent directory: npx tsx scripts/audit-financials.ts
 *
 * Prints debug output to verify:
 * - contract value
 * - labor row count and labor total
 * - material row count and material total
 * - billing history row count and billed_to_date
 * - billing line row count and earned_value
 * - pending CO count and value
 * - open RFI count
 */

import { getProjectFinancials } from "../src/lib/tools/getProjectFinancials";
import { getProjectSignals } from "../src/lib/tools/getProjectSignals";
import { listProjects } from "../src/lib/tools/listProjects";
import { loadCsv } from "../src/lib/data/loadCsv";

import path from "path";

const PROJECT_ID = "PRJ-2024-001";

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  process.chdir(projectRoot);

  console.log("=== Portfolio Audit for", PROJECT_ID, "===\n");

  const projects = await listProjects();
  console.log("listProjects() returns", projects.length, "projects\n");

  const contract = projects.find((p) => p.project_id === PROJECT_ID);
  if (contract) {
    console.log("Contract value:", contract.contract_value?.toLocaleString(), "\n");
  }

  const laborLogs = await loadCsv<Record<string, unknown>>("labor_logs.csv");
  const projectLabor = laborLogs.filter((r) => r.project_id === PROJECT_ID);
  console.log("Labor row count:", projectLabor.length);

  const materialDeliveries = await loadCsv<Record<string, unknown>>("material_deliveries.csv");
  const projectMaterial = materialDeliveries.filter((m) => m.project_id === PROJECT_ID);
  console.log("Material row count:", projectMaterial.length);

  const billingHistory = await loadCsv<Record<string, unknown>>("billing_history.csv");
  const projectBills = billingHistory.filter((b) => b.project_id === PROJECT_ID);
  const billedToDate = Math.max(
    ...projectBills.map((b) => Number(b.cumulative_billed) || 0),
    0
  );
  console.log("Billing history row count:", projectBills.length);
  console.log("Billed to date (max cumulative_billed):", billedToDate?.toLocaleString());

  const billingLineItems = await loadCsv<Record<string, unknown>>("billing_line_items.csv");
  const projectBillingLines = billingLineItems.filter(
    (b) => (b.project_id as string) === PROJECT_ID
  );
  console.log("Billing line row count (all):", projectBillingLines.length);

  const latestBySov = new Map<string, Record<string, unknown>>();
  for (const line of projectBillingLines) {
    const appNum = Number(line.application_number) || 0;
    const existing = latestBySov.get(line.sov_line_id as string);
    const existingApp = existing ? Number(existing.application_number) || 0 : -1;
    if (appNum > existingApp) {
      latestBySov.set(line.sov_line_id as string, line);
    }
  }
  console.log("Billing line unique SOV lines (latest per line):", latestBySov.size);

  let earnedValue = 0;
  for (const line of latestBySov.values()) {
    const scheduled = Number(line.scheduled_value) || 0;
    const pct = (Number(line.pct_complete) || 0) / 100;
    earnedValue += scheduled * pct;
  }
  console.log("Earned value (scheduled * pct_complete from latest):", Math.round(earnedValue).toLocaleString());

  const changeOrders = await loadCsv<Record<string, unknown>>("change_orders.csv");
  const projectCOs = changeOrders.filter((c) => c.project_id === PROJECT_ID);
  const pendingCOs = projectCOs.filter((c) =>
    ["pending", "under review"].includes(String(c.status || "").toLowerCase())
  );
  const pendingCOValue = pendingCOs.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  console.log("Pending CO count:", pendingCOs.length);
  console.log("Pending CO value:", Math.round(pendingCOValue).toLocaleString());

  const rfis = await loadCsv<Record<string, unknown>>("rfis.csv");
  const projectRFIs = rfis.filter((r) => r.project_id === PROJECT_ID);
  const openRFIs = projectRFIs.filter((r) => String(r.status || "").toLowerCase() !== "closed");
  console.log("Open RFI count:", openRFIs.length);

  console.log("\n=== getProjectFinancials output ===");
  const financials = await getProjectFinancials(PROJECT_ID);
  console.log(JSON.stringify(financials, null, 2));

  console.log("\n=== getProjectSignals output ===");
  const signals = await getProjectSignals(PROJECT_ID);
  console.log(JSON.stringify(signals, null, 2));

  console.log("\n=== Sanity checks ===");
  const contractVal = contract?.contract_value ?? 0;
  console.log("Earned value <= contract?", earnedValue <= contractVal * 1.01, `(earned: ${earnedValue.toLocaleString()}, contract: ${contractVal.toLocaleString()})`);
  console.log("Billed to date <= contract?", billedToDate <= contractVal * 1.01);
  console.log("Billing lag reasonable?", Math.abs(financials.billing_lag) < contractVal);
}

main().catch(console.error);
