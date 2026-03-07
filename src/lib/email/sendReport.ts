import { Resend } from "resend";
import React from "react";
import { EmailTemplate } from "./EmailTemplate";

const apiKey = process.env.RESEND_API_KEY;

export async function sendReportEmail(report: string) {
    if (!apiKey || apiKey.trim() === "") {
        throw new Error(
            "RESEND_API_KEY is not set. Add RESEND_API_KEY to your .env.local file."
        );
    }
    const resend = new Resend(apiKey);
    try {
        await resend.emails.send({
            from: "yashwanth292003@gmail.com",
            to: "yashwanth292003@gmail.com",
            subject: "HVAC Construction Portfolio Analysis Report",
            react: React.createElement(EmailTemplate, { report }),
        });
    } catch (error) {
        console.error("Error sending report email:", error);
        throw error;
    }
}