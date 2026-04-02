import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/server/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      x?: number;
      y?: number;
    };

    const session = body.sessionId ? getSession(body.sessionId) : undefined;
    if (!session) {
      return NextResponse.json({ message: "session not found" }, { status: 404 });
    }

    await session.page.mouse.move(body.x ?? 0, body.y ?? 0);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Mouse move failed" },
      { status: 500 },
    );
  }
}
