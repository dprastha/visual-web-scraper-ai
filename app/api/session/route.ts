import { NextRequest, NextResponse } from "next/server";

import { installHoverHighlight } from "@/lib/server/selector";
import {
  VIEWPORT,
  createSessionId,
  launchBrowserPage,
  storeSession,
} from "@/lib/server/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ message: "url required" }, { status: 400 });
    }

    const { browser, page } = await launchBrowserPage(url);
    await installHoverHighlight(page);

    const sessionId = createSessionId();
    storeSession(sessionId, { browser, page, createdAt: Date.now() });

    return NextResponse.json({ sessionId, viewport: VIEWPORT });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to create session",
      },
      { status: 500 },
    );
  }
}
