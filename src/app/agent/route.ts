import { NextRequest, NextResponse } from "next/server";

export async function POST() {

    return NextResponse.json({
        ok: true,
        message: "Agent is wired",
        timestamp: new Date().toISOString(),
    });
}
