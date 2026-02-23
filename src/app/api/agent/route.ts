import { NextResponse } from "next/server";
import { listProjects } from "@/lib/tools/listProjects";
import { getProjectFinancials } from "@/lib/tools/getProjectFinancials";
import { getProjectSignals } from "@/lib/tools/getProjectSignals";

export async function POST() {
  const projects = await listProjects();

  if (projects.length === 0) {
    return NextResponse.json({ ok: false, error: "No projects found" });
  }

  const sample = projects[0];

  const financials = await getProjectFinancials(sample.project_id);
  const signals = await getProjectSignals(sample.project_id);

  return NextResponse.json({
    ok: true,
    sample_project: sample,
    financials,
    signals,
  });
}