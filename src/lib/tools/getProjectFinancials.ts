import { loadCsv } from "../data/loadCsv";
import { Laborlog, MaterialDelivery, BillingHistory, BillingLineItem, SOVLine, ChangeOrder } from "../data/types";

import { toNumber, round } from "@/lib/metrics/projectMath";


export async function getProjectFinancials(projectId: string) {

    const laborLogs = await loadCsv<Laborlog>("labor_logs.csv");
    const materialDeliveries = await loadCsv<MaterialDelivery>("material_deliveries.csv");
    const billingHistory = await loadCsv<BillingHistory>("billing_history.csv");
    const billingLineItems = await loadCsv<BillingLineItem>("billing_line_items.csv");
    const sovLines = await loadCsv<SOVLine>("sov.csv");
    const changeOrders = await loadCsv<ChangeOrder>("change_orders.csv");



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
    const billedToDate = projectBills.length > 0 ? Math.max(...projectBills.map(b => toNumber((b as any).cumulative_billing, 0))) : 0;

    const sovProjectByLineId = new Map<string, string>();
    const scheduledValueByLineId = new Map<string, number>();

    for (const s of sovLines) {
        sovProjectByLineId.set(s.sov_line_id, s.project_id);
        scheduledValueByLineId.set(s.sov_line_id, toNumber(s.scheduled_value, 0));
    }

    let earnedValue = 0;

    for (const line of billingLineItems) {

        const blProjectId = sovProjectByLineId.get(line.sov_line_id);

        if (blProjectId !== projectId) {
            continue;
        }

        const scheduled = toNumber((line as any).scheduled_value, NaN) ?? 
        scheduledValueByLineId.get(line.sov_line_id) ?? 0;

        const pct = toNumber((line as any).pct_complete, 0) / 100;

        earnedValue += scheduled * pct;
    }

    const projectCOs = changeOrders.filter((c) => c.project_id === projectId);
    const pendingCOs = projectCOs.filter(
        (c) => String((c as any).status || "").toLowerCase() === "pending"
    );
    const pendingCOValue = pendingCOs.reduce((acc, c) => acc + toNumber((c as any).amount, 0), 0);

    const totalCost = laborCost + materialCost;
    const billingLag = earnedValue - billedToDate;

    const costOverEarned = totalCost - earnedValue;

    const recoverableExposure = Math.max(0, pendingCOValue) + Math.max(0, billingLag);


    
    return {
        project_id: projectId,
        labor_cost: round(laborCost),
        material_cost: round(materialCost),
        total_cost: round(totalCost),
        billed_to_date: round(billedToDate),
        earned_value: round(earnedValue),
        billing_lag: Math.round(billingLag),
        pending_change_order_value: round(pendingCOValue),

        cost_over_earned: round(costOverEarned),
        recoverable_exposure: round(recoverableExposure),

    };
}
    
