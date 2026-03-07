# HVAC Margin Rescue Agent

An AI agent that autonomously protects margin across a portfolio of HVAC construction projects. Given a single prompt like "How's my portfolio doing?", the agent scans the full portfolio, investigates risks, and produces actionable reports—including cross-project pattern detection and automated email delivery to stakeholders.

## Overview

Unlike a chatbot that answers one question, this agent **pursues a goal**: it reasons, plans, uses tools, and loops until the analysis is complete. It detects both individual project risks and **systemic patterns** across the portfolio (e.g., billing lag affecting multiple projects, shared risk drivers, margin erosion).

### Key Capabilities

- **Portfolio risk ranking** — Projects scored by risk with weighted financial exposure
- **Cross-project pattern detection** — Systemic billing lag, scope drift, margin erosion, shared risk drivers
- **Evidence-based analysis** — Field notes, RFI subjects, change order descriptions (not generic labels)
- **Automated reporting** — Final report emailed to CFO via Resend
- **Live activity streaming** — UI shows agent progress (tools called, investigation steps)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                        │
│  • Portfolio summary cards (contract, earned, cost, margin)       │
│  • Agent Activity panel (live tool execution)                    │
│  • Streamed risk report                                          │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POST /api/agent (Streaming)                    │
│  • ToolLoopAgent (Vercel AI SDK)                                 │
│  • NDJSON stream: activity events + report text                  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Tools                                   │
│  rankPortfolio │ detectPortfolioPatterns │ getProjectRiskScore   │
│  getProjectFinancials │ getProjectSignals │ getProjectEvidence   │
│  searchFieldNotes │ getProjectConfidence │ sendEmailReport       │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data (CSV in /data)                            │
│  contracts, sov, labor_logs, material_deliveries, billing_*     │
│  change_orders, rfis, field_notes                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Dataset

Synthetic HVAC construction project data with realistic interrelationships:

| File | Records | Description |
|------|---------|-------------|
| `contracts.csv` | 5 | Base contract info (project_id, original_contract_value, etc.) |
| `sov.csv` | 75 | Schedule of Values (15 lines per project) |
| `labor_logs.csv` | ~16K | Daily crew time entries |
| `material_deliveries.csv` | ~269 | Material receipts |
| `billing_history.csv` | ~83 | Pay application headers |
| `billing_line_items.csv` | ~964 | Pay application line details |
| `change_orders.csv` | ~64 | Change orders (Pending, Approved, Rejected) |
| `rfis.csv` | ~317 | RFI log |
| `field_notes.csv` | ~1.3K | Unstructured daily field reports |

**Key relationships:** Contracts → SOV → Labor/Material (cost-coded) → Billing. Change orders and RFIs link to projects and SOV lines.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd hvac-agent
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
OPENAI_API_KEY=sk-...     # Required for the agent
RESEND_API_KEY=re_...     # Required for email delivery
```

- **OPENAI_API_KEY** — From [OpenAI](https://platform.openai.com/api-keys). Used by the ToolLoopAgent.
- **RESEND_API_KEY** — From [Resend](https://resend.com). Used to email the final report. The `from` domain must be verified in Resend.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Run portfolio check** to trigger the agent.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
hvac-agent/
├── data/                    # CSV data files
│   ├── contracts.csv
│   ├── sov.csv
│   ├── labor_logs.csv
│   ├── material_deliveries.csv
│   ├── billing_history.csv
│   ├── billing_line_items.csv
│   ├── change_orders.csv
│   ├── rfis.csv
│   └── field_notes.csv
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/route.ts    # Main agent endpoint (streaming)
│   │   │   └── portfolio/route.ts # Portfolio summary (GET)
│   │   ├── page.tsx              # Frontend with Activity panel
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── data/
│   │   │   ├── loadCsv.ts        # CSV parsing (Papa Parse)
│   │   │   └── types.ts
│   │   ├── email/
│   │   │   └── sendReport.ts     # Resend email (HTML)
│   │   ├── metrics/
│   │   │   └── projectMath.ts
│   │   └── tools/
│   │       ├── listProjects.ts
│   │       ├── rankPortfolio.ts
│   │       ├── detectPortfolioPatterns.ts
│   │       ├── getProjectFinancials.ts
│   │       ├── getProjectRiskScore.ts
│   │       ├── getProjectSignals.ts
│   │       ├── getProjectEvidence.ts
│   │       ├── getProjectConfidence.ts
│   │       └── searchFieldNotes.ts
│   └── components/ui/            # shadcn components
```

## Tools Reference

| Tool | Purpose |
|------|---------|
| `listProjects` | List all projects with contract values |
| `rankPortfolio` | Rank projects by risk, compute portfolio_risk_index, overall status |
| `detectPortfolioPatterns` | Cross-project patterns: billing lag, scope drift, margin erosion, shared risk drivers |
| `getProjectRiskScore` | 0–10 risk score with reasons, financials, signals, evidence |
| `getProjectFinancials` | Labor cost, material cost, earned value, billing lag, margin, % complete |
| `getProjectSignals` | Change orders (pending value, descriptions), RFIs (open, cost-impact, subjects) |
| `getProjectEvidence` | Field note snippets, RFI subjects, CO descriptions (real evidence only) |
| `getProjectConfidence` | Confidence level from financials + signals + field note hits |
| `searchFieldNotes` | Keyword search in field notes (case-insensitive, underscore→space) |
| `sendEmailReport` | Email final report to CFO via Resend |

## Financial Formulas

- **Labor cost:** `(hours_st + hours_ot × 1.5) × hourly_rate × burden_multiplier`
- **Earned value:** `scheduled_value × (pct_complete / 100)` from **latest** billing line per SOV line (not summed across pay apps)
- **Billed to date:** `max(cumulative_billed)` per project
- **Billing lag:** `max(0, earned_value - billed_to_date)`
- **Cost over earned:** `total_cost - earned_value`
- **Margin:** `earned_value - total_cost`
- **Margin %:** `margin / contract_value`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | POST | Runs the agent. Returns NDJSON stream: `{type:"activity",text:"..."}` and `{type:"text",chunk:"..."}` |
| `/api/portfolio` | GET | Returns portfolio summary (overall_status, patterns, ranked projects) |

## Cross-Project Patterns

`detectPortfolioPatterns` identifies:

1. **Systemic billing lag** — Billing lag >$100K in 2+ projects
2. **Design/coordination instability** — Open RFIs >10 in 2+ projects
3. **Scope drift** — Pending COs >$100K in 2+ projects
4. **Margin erosion** — Cost over earned >$250K in 2+ projects
5. **Thin margin concentration** — Margin <10% in 2+ projects
6. **Shared risk driver** — Same top reason in 2+ projects
7. **Portfolio concentration** — High/medium risk in majority of projects

Each finding includes affected project IDs, severity, and recommended actions.

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **Vercel AI SDK** (ToolLoopAgent, streaming)
- **OpenAI** (gpt-4o-mini)
- **Resend** (email)
- **Papa Parse** (CSV)
- **Tailwind CSS** + **shadcn/ui**
- **Zod** (schema validation)

## Deployment

### Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add `OPENAI_API_KEY` and `RESEND_API_KEY` in project settings
4. Deploy

### Other Platforms

Ensure the platform supports:

- Node.js 18+
- Streaming responses
- Environment variables

## Troubleshooting

- **No logs in terminal** — Logs appear in the terminal where `npm run dev` runs (server), not the browser console.
- **Email not sending** — Verify `RESEND_API_KEY` in `.env.local` and that the `from` domain is verified in Resend.
- **Agent stops early** — `stopWhen` limits to 15 steps. Increase if needed for larger portfolios.
- **Financial values seem wrong** — Inspect `getProjectFinancials` and `getProjectRiskScore` outputs for the project in question.

## License

Private project.
