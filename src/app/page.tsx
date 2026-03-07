"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

type ActivityStep = {
  id: string;
  text: string;
  status: "active" | "complete";
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [portfolio, setPortfolio] = useState<{
    overall_status?: string;
    all_low_risk?: boolean;
    patterns?: string[];
    ranked?: Array<{
      project_id: string;
      risk_score: number;
      risk_band: string;
      contract_value?: number;
      earned_value?: number;
      total_cost?: number;
      billing_lag?: number;
      margin?: number;
      margin_pct?: number;
    }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((res) => res.ok ? res.json() : null)
      .then(setPortfolio)
      .catch(() => setPortfolio(null));
  }, []);

  async function run() {
    setLoading(true);
    setResult(null);
    setActivitySteps([{ id: "init", text: "Starting analysis…", status: "active" }]);
    try {
      const res = await fetch("/api/agent", { method: "POST" });
      if (!res.ok) throw new Error("Agent request failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream available");
      const decoder = new TextDecoder();
      let buffer = "";
      let reportText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as { type: string; text?: string; chunk?: string; message?: string };
            if (msg.type === "activity" && msg.text) {
              const activityText = msg.text;
              setActivitySteps((prev) => [
                ...prev.map((s) => ({ ...s, status: "complete" as const })),
                { id: crypto.randomUUID(), text: activityText, status: "active" as const },
              ]);
            } else if (msg.type === "text" && msg.chunk) {
              reportText += msg.chunk;
              setResult(reportText);
            } else if (msg.type === "done") {
              setActivitySteps((prev) => prev.map((s) => ({ ...s, status: "complete" as const })));
            } else if (msg.type === "error") {
              setResult((r) => (r ?? "") + "\n\nError: " + (msg.message ?? "Unknown error"));
            }
          } catch {
            // skip malformed lines
          }
        }
        if (done) break;
      }
      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer) as { type: string; chunk?: string };
          if (msg.type === "text" && msg.chunk) {
            reportText += msg.chunk;
            setResult(reportText);
          }
        } catch {
          // ignore
        }
      }
      fetch("/api/portfolio").then((r) => r.ok ? r.json() : null).then(setPortfolio);
    } catch (error) {
      console.error(error);
      setResult("Error running agent.");
      setActivitySteps((prev) => prev.map((s) => ({ ...s, status: "complete" as const })));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>HVAC Margin Rescue Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={run} disabled={loading}>
              {loading ? "Running…" : "Run portfolio check"}
            </Button>

            {portfolio?.ranked && portfolio.ranked.length > 0 && (
              <div className="grid gap-4 pt-2">
                <h3 className="font-semibold">
                  Portfolio Summary: {portfolio.overall_status ?? "—"}
                  {portfolio.all_low_risk && " (Top relative risks, none critical)"}
                </h3>
                {portfolio.patterns && portfolio.patterns.length > 0 && (
                  <p className="text-sm text-amber-600">{portfolio.patterns.join(" ")}</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {portfolio.ranked.slice(0, 6).map((p) => (
                    <Card key={p.project_id} className="border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          {p.project_id}
                          <Badge variant={p.risk_band === "High" ? "destructive" : p.risk_band === "Medium" ? "secondary" : "outline"}>
                            {p.risk_band} ({p.risk_score}/10)
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div>Contract: {formatCurrency(p.contract_value ?? 0)}</div>
                        <div>Earned: {formatCurrency(p.earned_value ?? 0)}</div>
                        <div>Cost: {formatCurrency(p.total_cost ?? 0)}</div>
                        <div>Billing Lag: {formatCurrency(p.billing_lag ?? 0)}</div>
                        <div>Margin: {formatCurrency(p.margin ?? 0)} ({formatPct(p.margin_pct ?? 0)})</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {(loading || activitySteps.length > 0) && (
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Agent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {activitySteps.map((step) => (
                      <li key={step.id} className="flex items-center gap-2">
                        {step.status === "complete" ? (
                          <span className="text-green-600" aria-hidden>✓</span>
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        <span className={step.status === "complete" ? "text-muted-foreground" : ""}>
                          {step.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result && (
              <div>
                <h3 className="font-semibold mb-2">Portfolio Risk Report</h3>
                <pre className="rounded-lg border p-4 text-sm whitespace-pre-wrap overflow-auto bg-muted/30 max-h-[32rem]">
                  {result}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}