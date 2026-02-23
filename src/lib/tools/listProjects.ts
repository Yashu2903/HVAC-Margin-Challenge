import { loadCsv } from "../data/loadCsv";
import type { Contract } from "../data/types";

async function listProjects() {
  const contracts = await loadCsv<Contract>("contracts.csv");
  return contracts.map((c) => ({
    project_id: c.project_id,
    project_name: c.project_name,
    contract_value: Number(c.original_contract_value),
  }));
}

export { listProjects };
