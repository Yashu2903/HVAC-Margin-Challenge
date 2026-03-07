import { Resend } from "resend";
import React from "react";
import { EmailTemplate } from "./EmailTemplate";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReportEmail(report: string) {
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