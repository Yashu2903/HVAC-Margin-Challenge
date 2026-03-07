import { Resend } from "resend";
import { marked } from "marked";

const apiKey = process.env.RESEND_API_KEY;

export async function sendReportEmail(report: string) {
    console.log("[sendReportEmail] Step 1: Function called, report length:", report?.length ?? 0);

    if (!apiKey || apiKey.trim() === "") {
        console.error("[sendReportEmail] Step 2: FAILED - RESEND_API_KEY is not set");
        throw new Error(
            "RESEND_API_KEY is not set. Add RESEND_API_KEY to your .env.local file."
        );
    }
    console.log("[sendReportEmail] Step 2: API key present (length:", apiKey.length, ")");

    const resend = new Resend(apiKey);
    console.log("[sendReportEmail] Step 3: Resend client created");

    const reportHtml = marked.parse(report, { async: false }) as string;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>HVAC Portfolio Report</title>
<style>
  body { font-family: sans-serif; padding: 1rem; max-width: 900px; font-size: 14px; line-height: 1.5; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  h2 { font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
  h3 { font-size: 1rem; margin-top: 1rem; margin-bottom: 0.5rem; }
  ul { margin: 0.5rem 0; padding-left: 1.5rem; }
</style>
</head>
<body>
<h1 style="font-size: 1.25rem; margin-bottom: 1rem;">HVAC Portfolio Risk Report</h1>
<div>${reportHtml}</div>
</body>
</html>`;

    try {
        console.log("[sendReportEmail] Step 4: Sending email...");
        const { data, error } = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: "your_gmail_address@domain.com",
            subject: "HVAC Construction Portfolio Analysis Report",
            html,
        });

        if (error) {
            console.error("[sendReportEmail] Step 5: Resend API error:", error);
            throw error;
        }
        console.log("[sendReportEmail] Step 5: Email sent successfully, id:", data?.id);
    } catch (error) {
        console.error("[sendReportEmail] Step 5: Exception caught:", error);
        throw error;
    }
}