"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/agent", { method: "POST" });
      const reader = res.body?.getReader();

      const decoder = new TextDecoder();
      let text = "";

      if (reader) {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          text += decoder.decode(value, {stream: true});
          setResult(text);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>HVAC Margin Rescue Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={run} disabled={loading}>
              {loading ? "Running…" : "Run portfolio check"}
            </Button>

            {result && (
              <pre className="rounded-lg border p-3 text-sm overflow-auto">
                {result}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}