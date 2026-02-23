import { loadCsv } from "../data/loadCsv";
import { ChangeOrder, RFI} from "../data/types";

export async function getProjectSignals(projectId: string) {
    const changeOrders = await loadCsv<ChangeOrder>("change_orders.csv");

    const rfis = await loadCsv<RFI>("rfis.csv");

    const projectCOs = changeOrders.filter(c => c.project_id === projectId);
    const pendingCOs = projectCOs.filter(c => c.status?.toLowerCase() === "pending");

    const pendingCOValue = pendingCOs.reduce(
        (acc, c) => acc + Number(c.amount || 0), 0);
    
    const projectRFIs = rfis.filter(r => r.project_id === projectId);
    const openRFIs = projectRFIs.filter(r => r.status?.toLowerCase() !== "closed");
    const costImpactRFIs = projectRFIs.filter(r => String(r.cost_impact).toLowerCase() === "true");

    return {
        project_id: projectId,
        change_orders: {
            total: projectCOs.length,
            pending_count: pendingCOs.length,
            pending_value: Math.round(pendingCOValue),
        },
        rfis: {
            total: projectRFIs.length,
            open: openRFIs.length,
            cost_impact: costImpactRFIs.length,

        },

    };
}