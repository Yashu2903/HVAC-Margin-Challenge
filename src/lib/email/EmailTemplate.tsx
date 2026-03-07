import * as React from "react";

export function EmailTemplate({ report }: { report: string }) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem", whiteSpace: "pre-wrap" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>HVAC Portfolio Risk Report</h1>
      <pre style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5 }}>{report}</pre>
    </div>
  );
}
