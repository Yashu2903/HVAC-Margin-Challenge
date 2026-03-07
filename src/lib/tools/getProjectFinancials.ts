import { loadCsv } from "../data/loadCsv";
import { Laborlog, MaterialDelivery, BillingHistory, BillingLineItem, SOVLine, ChangeOrder, Contract } from "../data/types";

import { toNumber, round } from "@/lib/metrics/projectMath";


export async function getProjectFinancials(projectId: string) {

    const contracts = await loadCsv<Contract>("contracts.csv");
    const laborLogs = await loadCsv<Laborlog>("labor_logs.csv");
    const materialDeliveries = await loadCsv<MaterialDelivery>("material_deliveries.csv");
    const billingHistory = await loadCsv<BillingHistory>("billing_history.csv");
    const billingLineItems = await loadCsv<BillingLineItem>("billing_line_items.csv");
    const sovLines = await loadCsv<SOVLine>("sov.csv");
    const changeOrders = await loadCsv<ChangeOrder>("change_orders.csv");

    const contract = contracts.find((c) => c.project_id === projectId);
    const contractValue = contract ? toNumber(contract.original_contract_value, 0) : 0;



    const projectLabor = laborLogs.filter(l => l.project_id === projectId);

    let laborCost = 0;

    for (const l of projectLabor) {
        const st = toNumber((l as any).hours_st, 0);
        const ot = toNumber((l as any).hours_ot, 0);
        const hourlyRate = toNumber((l as any).hourly_rate, 0);
        const burdenMultiplier = toNumber((l as any).burden_multiplier, 1.4);
        laborCost += (st + ot * 1.5) * hourlyRate * burdenMultiplier;
    }

    const projectMaterial = materialDeliveries.filter(m => m.project_id === projectId);
    const materialCost = projectMaterial.reduce((acc, m) => acc + toNumber((m as any).total_cost, 0), 0);

    const projectBills = billingHistory.filter(b => b.project_id === projectId);

    const billedToDate =
        projectBills.length > 0
        ? Math.max(...projectBills.map(b => toNumber((b as any).cumulative_billed, 0)))
        : 0;

    const sovProjectByLineId = new Map<string, string>();
    const scheduledValueByLineId = new Map<string, number>();

    for (const s of sovLines) {
        sovProjectByLineId.set(s.sov_line_id, s.project_id);
        scheduledValueByLineId.set(s.sov_line_id, toNumber(s.scheduled_value, 0));
    }

    // billing_line_items has one row per SOV line per pay application - we must take
    // the LATEST row per sov_line_id only, otherwise we sum historical snapshots and inflate earned value
    const latestBySovLine = new Map<string, BillingLineItem>();
    for (const line of billingLineItems) {
        const blProjectId = (line as any).project_id ?? sovProjectByLineId.get(line.sov_line_id);
        if (blProjectId !== projectId) continue;

        const appNum = toNumber((line as any).application_number, 0);
        const existing = latestBySovLine.get(line.sov_line_id);
        const existingApp = existing ? toNumber((existing as any).application_number, 0) : -1;
        if (appNum > existingApp) {
            latestBySovLine.set(line.sov_line_id, line);
        }
    }

    let earnedValue = 0;
    for (const line of latestBySovLine.values()) {
        const scheduledVal = toNumber((line as any).scheduled_value, NaN);
        const scheduled = Number.isFinite(scheduledVal) ? scheduledVal : (scheduledValueByLineId.get(line.sov_line_id) ?? 0);
        const pct = toNumber((line as any).pct_complete, 0) / 100;
        earnedValue += scheduled * pct;
    }

    const projectCOs = changeOrders.filter((c) => c.project_id === projectId);
    const pendingStatuses = ["pending", "under review"];
    const pendingCOs = projectCOs.filter(
        (c) => pendingStatuses.includes(String((c as any).status || "").toLowerCase())
    );
    const pendingCOValue = pendingCOs.reduce((acc, c) => acc + toNumber((c as any).amount, 0), 0);

    const totalCost = laborCost + materialCost;

    // Sanity checks: clamp earned_value to contract, flag anomalies
    const earnedValueClamped = contractValue > 0 ? Math.min(earnedValue, contractValue) : earnedValue;
    const anomalies: string[] = [];
    if (contractValue > 0 && earnedValue > contractValue) {
        anomalies.push("earned_value exceeded contract_value (clamped)");
    }
    if (contractValue > 0 && billedToDate > contractValue * 1.1) {
        anomalies.push("billed_to_date exceeds contract_value by >10%");
    }
    if (contractValue > 0 && totalCost > contractValue * 2) {
        anomalies.push("total_cost exceeds 2x contract_value (possible data error)");
    }

    const billingLagRaw = earnedValueClamped - billedToDate;
    const billingLag = Math.max(0, billingLagRaw);

    const costOverEarned = totalCost - earnedValueClamped;

    const recoverableExposure = Math.max(0, billingLag) + Math.max(0, pendingCOValue);

    const margin = earnedValueClamped - totalCost;
    const marginPct = contractValue > 0 ? margin / contractValue : 0;
    const percentComplete = contractValue > 0 ? earnedValueClamped / contractValue : 0;

    const laborCostRatio = totalCost > 0 ? laborCost / totalCost : 0;
    const materialCostRatio = totalCost > 0 ? materialCost / totalCost : 0;

    if (process.env.NODE_ENV !== "production") {
        console.log("[getProjectFinancials]", projectId, {
            contract_value: contractValue,
            earned_value: round(earnedValueClamped),
            billed_to_date: round(billedToDate),
            total_cost: round(totalCost),
            billing_lag: Math.round(billingLag),
            cost_over_earned: round(costOverEarned),
        });
    }

    return {
        project_id: projectId,
        contract_value: round(contractValue),
        labor_cost: round(laborCost),
        material_cost: round(materialCost),
        total_cost: round(totalCost),
        billed_to_date: round(billedToDate),
        earned_value: round(earnedValueClamped),
        billing_lag: Math.round(billingLag),
        pending_change_order_value: round(pendingCOValue),
        cost_over_earned: round(costOverEarned),
        recoverable_exposure: round(recoverableExposure),
        margin: round(margin),
        margin_pct: Math.round(marginPct * 10000) / 10000,
        percent_complete: Math.round(percentComplete * 10000) / 10000,
        labor_cost_ratio: Math.round(laborCostRatio * 10000) / 10000,
        material_cost_ratio: Math.round(materialCostRatio * 10000) / 10000,
        anomalies: anomalies.length > 0 ? anomalies : undefined,
    };
}
    
