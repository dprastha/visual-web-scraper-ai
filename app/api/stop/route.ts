import { NextRequest, NextResponse } from "next/server";

import { closeSession } from "@/lib/server/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId?: string };

    if (body.sessionId) {
      await closeSession(body.sessionId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Stop failed" },
      { status: 500 },
    );
  }
}
