import { ToolLoopAgent, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { listProjects } from "@/lib/tools/listProjects";
import { getProjectFinancials } from "@/lib/tools/getProjectFinancials";
import { getProjectSignals } from "@/lib/tools/getProjectSignals";
import { searchFieldNotes } from "@/lib/tools/searchFieldNotes";
import { getProjectEvidence } from "@/lib/tools/getProjectEvidence";

import { rankPortfolio } from "@/lib/tools/rankPortfolio";
import { getProjectConfidence } from "@/lib/tools/getProjectConfidence";
import { getProjectRiskScore } from "@/lib/tools/getProjectRiskScore";
import { detectPortfolioPatterns } from "@/lib/tools/detectPortfolioPatterns";
import { sendReportEmail } from "@/lib/email/sendReport";

const agent = new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  tools: {
    listProjects: tool({
      description: "Get a list of all projects in the portfolio",
      inputSchema: z.object({}),
      execute: async () => await listProjects(),
    }),

    getProjectFinancials: tool({
      description: "Get the full financial snapshot of a project",
      inputSchema: z.object({
        project_id: z.string(),
      }),
      execute: async ({ project_id }) =>
        await getProjectFinancials(project_id),
    }),

    getProjectSignals: tool({
      description: "Get change order and RFI risk signals",
      inputSchema: z.object({
        project_id: z.string(),
      }),
      execute: async ({ project_id }) =>
        await getProjectSignals(project_id),
    }),

    searchFieldNotes: tool({
      description: "Search field notes for specific keywords",
      inputSchema: z.object({
        project_id: z.string(),
        query: z.string(),
      }),
      execute: async ({ project_id, query }) =>
        await searchFieldNotes(project_id, query),
    }),

    rankPortfolio: tool({
      description: "Rank projects by risk with key drivers and exposure metrics",
      inputSchema: z.object({}),
      execute: async () => {
        console.log("[AGENT] rankPortfolio execute called");
        return await rankPortfolio();
      },
    }),

    detectPortfolioPatterns: tool({
      description: "Detect cross-project patterns (systemic billing lag, shared risk drivers, margin erosion, scope drift). Use to identify portfolio-level issues, not just individual project risks.",
      inputSchema: z.object({}),
      execute: async () => await detectPortfolioPatterns(),
    }),

    getProjectRiskScore: tool({
      description: "Compute a 0-10 risk score with reasons and attached financials/signals",
      inputSchema: z.object({
        project_id: z.string(),
      }),
      execute: async ({ project_id }) =>
        await getProjectRiskScore(project_id),
    }),

    getProjectConfidence: tool({
      description: "Compute confidence using multiple signals + field note evidence frequency",
      inputSchema: z.object({
        project_id: z.string(),
      }),
      execute: async ({ project_id }) =>
        await getProjectConfidence(project_id),
    }),

    getProjectEvidence: tool({
      description: "Get real evidence: field note snippets, RFI subjects, change order descriptions (not generic risk labels)",
      inputSchema: z.object({
        project_id: z.string(),
      }),
      execute: async ({ project_id }) =>
        await getProjectEvidence(project_id),
    }),

    sendEmailReport: tool({
      description: "Send the final portfolio analysis report to the CFO by email",
      inputSchema: z.object({
        report: z.string(),
      }),
      execute: async ({ report }) => {
        console.log("[sendEmailReport tool] Agent invoked sendEmailReport, report length:", report?.length ?? 0);
        await sendReportEmail(report);
        console.log("[sendEmailReport tool] sendReportEmail completed successfully");
        return { status: "email_sent" };
      },
    }),
  },

  stopWhen: ({ steps }) => {
    const stop = steps.length >= 15;
    if (stop) console.log("[AGENT] stopWhen: reached", steps.length, "steps, stopping");
    return stop;
  }
});

export async function POST() {
  console.log("[AGENT] ========== POST /api/agent called ==========");

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "OpenAI API key is missing. Set OPENAI_API_KEY in your environment.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("[AGENT] Starting agent.stream()...");
  const result = await agent.stream({
    messages: [
      {
        role: "system",
        content: `You are a CFO-level AI agent protecting margin across HVAC construction projects.

Process you MUST follow (complete ALL steps in order):

1. Call rankPortfolio first. Wait for the result.
2. Call detectPortfolioPatterns to identify cross-project patterns (systemic issues across the portfolio).
3. From rankPortfolio.ranked, identify the top 3 projects by portfolio_risk_index.
4. For EACH of those 3 projects, call in sequence: getProjectRiskScore, getProjectFinancials, getProjectSignals, getProjectEvidence. Do not skip these.
5. Use searchFieldNotes when identifying root causes for risky projects.
6. Produce the final report in the OUTPUT FORMAT below. Include detectPortfolioPatterns findings in the PORTFOLIO SUMMARY (Patterns section).
7. CRITICAL: As your FINAL action, you MUST call sendEmailReport with the complete report text as the report parameter. The task is NOT complete until you have called sendEmailReport. Do not finish without calling this tool.

Never guess. Always use tools for data. Do not skip steps 2-7.

EVIDENCE RULE: Only include real evidence in the Evidence section:
- Field note snippets (e.g., "Field note (Feb 14): Crew waiting on revised piping layout from engineer.")
- RFI subjects
- Change order descriptions
Do NOT use generic labels like "High billing lag" as evidence—that is a driver, not evidence.

PORTFOLIO SUMMARY RULE: If all projects are Low risk (overall_status: Healthy), say:
"Overall: Healthy. Top relative risks (none critical)"
and describe the highest-relative-risk projects as "highest relative risks" not "critical risks."

OUTPUT FORMAT (must follow exactly):

PORTFOLIO SUMMARY
- Overall: <Healthy/Mixed/At Risk> (use rankPortfolio.overall_status)
- Cross-project patterns: <from detectPortfolioPatterns.findings—systemic issues, affected projects, recommended actions>
- Top risks: <bullets>

TOP RISK PROJECTS (ranked by portfolio_risk_index)
For each:
- Project: <id>
- Risk: <Low/Medium/High> (score X/10)
- Contract Value | Earned Value | Cost to Date | Billing Lag
- Margin ($): <margin> | Margin %: <margin_pct>
- Drivers: <bullets>
- Evidence: <1-3 field note snippets, RFI subjects, or CO descriptions—NOT generic labels>
- Confidence: <Low/Medium/High>
- Next 7 days actions: <bullets>

After writing the report above, you MUST call sendEmailReport(report: "<the full report text>") to email it to the CFO. Do not end without calling sendEmailReport.`,
      },
      {
        role: "user",
        content: "Analyze my HVAC construction portfolio using the available tools and generate the required risk report.",
      },
    ],
  });

  const activityLabels: Record<string, (input?: Record<string, unknown>) => string> = {
    rankPortfolio: () => "Scanning portfolio financials",
    listProjects: () => "Loading project list",
    getProjectFinancials: (input) => input?.project_id ? `Getting financials for ${input.project_id}` : "Getting project financials",
    getProjectSignals: (input) => input?.project_id ? `Reviewing RFIs and change orders for ${input.project_id}` : "Reviewing RFIs and change orders",
    getProjectRiskScore: (input) => input?.project_id ? `Investigating ${input.project_id}` : "Computing risk score",
    getProjectConfidence: (input) => input?.project_id ? `Assessing confidence for ${input.project_id}` : "Assessing confidence",
    getProjectEvidence: (input) => input?.project_id ? `Gathering evidence for ${input.project_id}` : "Gathering evidence",
    searchFieldNotes: (input) => input?.query ? `Searching field notes for "${input.query}"` : "Searching field notes",
    sendEmailReport: () => "Sending report to CFO by email",
    detectPortfolioPatterns: () => "Detecting cross-project patterns",
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log("[AGENT] Consuming fullStream...");
        for await (const part of result.fullStream) {
          const p = part as { type: string; toolName?: string; input?: Record<string, unknown>; text?: string };
          if (p.type === "tool-call" && p.toolName) {
            console.log("[AGENT] Tool called:", p.toolName);
            if (p.toolName === "sendEmailReport") {
              console.log("[AGENT] >>> sendEmailReport tool invoked by agent <<<");
            }
            const label = activityLabels[p.toolName]?.(p.input as Record<string, unknown>) ?? `Running ${p.toolName}`;
            controller.enqueue(encoder.encode(JSON.stringify({ type: "activity", text: label }) + "\n"));
          } else if (p.type === "text-delta" && p.text) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: "text", chunk: p.text }) + "\n"));
          }
        }
        console.log("[AGENT] Stream complete, sending done");
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
      } catch (err) {
        console.error("[AGENT] Stream error:", err);
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: String(err) }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
