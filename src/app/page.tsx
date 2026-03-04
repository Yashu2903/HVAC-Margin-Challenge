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
  
      if (!res.ok) {
        throw new Error("Agent request failed");
      }
  
      const reader = res.body?.getReader();
  
      if (!reader) {
        throw new Error("No response stream available");
      }
  
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

    } catch (error) {
      console.error(error);
      setResult("Error running agent.");
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