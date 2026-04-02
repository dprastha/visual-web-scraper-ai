import { NextRequest, NextResponse } from "next/server";

import { getElementInfoAtPoint } from "@/lib/server/selector";
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

    const x = body.x ?? 0;
    const y = body.y ?? 0;

    await session.page.mouse.click(x, y, { delay: 40 });
    const info = await getElementInfoAtPoint(session.page, x, y);

    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Click failed" },
      { status: 500 },
    );
  }
}
