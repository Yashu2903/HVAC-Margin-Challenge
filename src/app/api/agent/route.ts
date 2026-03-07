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
      execute: async () => await rankPortfolio(),
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
  },

  stopWhen: ({ steps }) => {
    console.log("Agent steps:", steps.length);
    return steps.length >= 10;
  }
});

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "OpenAI API key is missing. Set OPENAI_API_KEY in your environment.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = await agent.stream({
    messages: [
      {
        role: "system",
        content: `You are a CFO-level AI agent protecting margin across HVAC construction projects.

Process you MUST follow:

1. ALWAYS call rankPortfolio before writing any analysis.
2. Use the returned data to identify the top 3 risky projects (by portfolio_risk_index).
3. For each risky project call:
   - getProjectRiskScore (includes evidence)
   - getProjectFinancials
   - getProjectSignals
   - getProjectEvidence (for real evidence: field notes, RFIs, CO descriptions)
4. Use searchFieldNotes when identifying root causes.
5. Only after using tools produce the final report.

Never guess. Always use tools for data.

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
- Patterns: <any cross-project patterns from rankPortfolio.patterns>
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

Do not output tool JSON. Only the formatted report.`,
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
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          const p = part as { type: string; toolName?: string; input?: Record<string, unknown>; text?: string };
          if (p.type === "tool-call" && p.toolName) {
            const label = activityLabels[p.toolName]?.(p.input as Record<string, unknown>) ?? `Running ${p.toolName}`;
            controller.enqueue(encoder.encode(JSON.stringify({ type: "activity", text: label }) + "\n"));
          } else if (p.type === "text-delta" && p.text) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: "text", chunk: p.text }) + "\n"));
          }
        }
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
      } catch (err) {
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
