import { loadCsv } from "../data/loadCsv";
import { Laborlog, MaterialDelivery, BillingHistory, BillingLineItem } from "../data/types";

export async function getProjectFinancials(projectId: string) {

    const laborLogs = await loadCsv<Laborlog>("labor_logs.csv");
    const materialDeliveries = await loadCsv<MaterialDelivery>("material_deliveries.csv");
    const billingHistory = await loadCsv<BillingHistory>("billing_history.csv");
    const billingLineItems = await loadCsv<BillingLineItem>("billing_line_items.csv");


    const projectLabor = laborLogs.filter(l => l.project_id === projectId);

    let laborCost = 0;

    for (const l of projectLabor) {
        const st = Number(l.hours_st || 0);
        const ot = Number(l.hours_ot || 0);
        const hourlyRate = Number(l.hourly_rate || 0);
        const burdenMultiplier = Number(l.burden_multiplier || 1.4);
        laborCost += (st + ot * 1.5) * hourlyRate * burdenMultiplier;
    }

    const projectMaterial = materialDeliveries.filter(m => m.project_id === projectId);
    const materialCost = projectMaterial.reduce((acc, m) => acc + Number(m.total_cost || 0), 0);

    const projectBills = billingHistory.filter(b => b.project_id === projectId);
    const billedToDate = projectBills.length > 0 ? Math.max(...projectBills.map(b => Number(b.cumulative_billing || 0))) : 0;

    let earnedValue = 0;

    for (const line of billingLineItems) {
        const scheduled = Number(line.scheduled_value || 0);
        const pct = Number(line.pct_complete || 0) / 100;
        earnedValue += scheduled * pct;
    }
    
    return {
        project_id: projectId,
        labor_cost: Math.round(laborCost),
        material_cost: Math.round(materialCost),
        total_cost: Math.round(laborCost + materialCost),
        billed_to_date: Math.round(billedToDate),
        earned_value: Math.round(earnedValue),
        billing_lag: Math.round(earnedValue - billedToDate),

    };
}
    
