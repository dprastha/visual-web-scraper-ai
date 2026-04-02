import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/server/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      deltaY?: number;
    };

    const session = body.sessionId ? getSession(body.sessionId) : undefined;
    if (!session) {
      return NextResponse.json({ message: "session not found" }, { status: 404 });
    }

    if (session.page.mouse.wheel) {
      await session.page.mouse.wheel({ deltaY: body.deltaY ?? 0 });
    } else {
      await session.page.evaluate((value) => window.scrollBy(0, value), body.deltaY ?? 0);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Scroll failed" },
      { status: 500 },
    );
  }
}
