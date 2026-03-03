import { ToolLoopAgent ,streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { listProjects } from "@/lib/tools/listProjects";
import { getProjectFinancials } from "@/lib/tools/getProjectFinancials";
import { getProjectSignals } from "@/lib/tools/getProjectSignals";
import { searchFieldNotes } from "@/lib/tools/searchFieldNotes";

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
  },

  stopWhen: ({ steps }) => steps.length >= 10,
});

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key is missing. Set OPENAI_API_KEY in your environment." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = await agent.stream({
    messages: [
      {
        role: "system",
        content: `You are a CFO-level AI agent protecting margin across HVAC construction projects.

Your Job:
1. Scan the portfolio
2. Identify risks
3. Investigate root causes
4. Recommend corrective actions
5. Do not stop after one step`
      },
      {
        role: "user",
        content: "How is my portfolio performing?"
      }
    ]
  });

  return result.toTextStreamResponse();
}
