import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/server/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ message: "sessionId required" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return new NextResponse("session not found", { status: 404 });
  }

  try {
    const screenshot = await session.page.screenshot({
      type: "png",
      fullPage: false,
    });

    return new NextResponse(Buffer.from(screenshot), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Screenshot failed" },
      { status: 500 },
    );
  }
}
