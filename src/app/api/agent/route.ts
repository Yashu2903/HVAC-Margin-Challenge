import { ToolLoopAgent, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { listProjects } from "@/lib/tools/listProjects";
import { getProjectFinancials } from "@/lib/tools/getProjectFinancials";
import { getProjectSignals } from "@/lib/tools/getProjectSignals";
import { searchFieldNotes } from "@/lib/tools/searchFieldNotes";

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
2. Use the returned data to identify the top 3 risky projects.
3. For each risky project call:
   - getProjectRiskScore
   - getProjectFinancials
   - getProjectSignals
4. Use searchFieldNotes when identifying root causes.
5. Only after using tools produce the final report.

Never guess. Always use tools for data.

OUTPUT FORMAT (must follow exactly):

PORTFOLIO SUMMARY
- Overall: <Healthy/Mixed/At Risk>
- Top risks: <bullets>

TOP RISK PROJECTS (ranked)
For each:
- Project: <id>
- Risk: <Low/Medium/High> (score X/10)
- True margin loss proxy ($): <cost_over_earned>
- Recoverable exposure ($): <recoverable_exposure>
- Drivers: <bullets>
- Evidence: <1-3 short snippets or references>
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

  const test = await rankPortfolio();
  console.log("portfolio ranking:", test);

  return result.toTextStreamResponse({
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
