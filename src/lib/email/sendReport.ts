import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, "<br>");
}

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

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>HVAC Portfolio Report</title></head>
<body style="font-family: sans-serif; padding: 1rem; max-width: 800px;">
<h1 style="font-size: 1.25rem; margin-bottom: 1rem;">HVAC Portfolio Risk Report</h1>
<div style="white-space: pre-wrap; font-size: 0.875rem; line-height: 1.5;">${escapeHtml(report)}</div>
</body>
</html>`;

    try {
        console.log("[sendReportEmail] Step 4: Sending email...");
        const { data, error } = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: "yashwanth292003@gmail.com",
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