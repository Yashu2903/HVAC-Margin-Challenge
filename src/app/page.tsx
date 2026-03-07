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

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
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
    try {
      const res = await fetch("/api/agent", { method: "POST" });
      if (!res.ok) throw new Error("Agent request failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream available");
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          text += decoder.decode(value);
          setResult(text);
        }
        if (done) break;
      }
      text += decoder.decode();
      setResult(text);
      fetch("/api/portfolio").then((r) => r.ok ? r.json() : null).then(setPortfolio);
    } catch (error) {
      console.error(error);
      setResult("Error running agent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>HVAC Margin Rescue Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={run} disabled={loading}>
              {loading ? "Running…" : "Run portfolio check"}
            </Button>

            {portfolio?.ranked && portfolio.ranked.length > 0 && (
              <div className="grid gap-4 pt-4">
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

            {result && (
              <pre className="rounded-lg border p-3 text-sm whitespace-pre-wrap overflow-auto">
                {result}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}