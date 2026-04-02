import { NextRequest, NextResponse } from "next/server";

import { getElementInfoAtPoint, installHoverHighlight } from "@/lib/server/selector";
import {
  VIEWPORT,
  closeSession,
  createSessionId,
  getSession,
  launchBrowserPage,
  storeSession,
} from "@/lib/server/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  if (action !== "screenshot") {
    return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ message: "sessionId required" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ message: "session not found" }, { status: 404 });
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as
      | { action?: "start"; url?: string }
      | { action?: "stop"; sessionId?: string }
      | { action?: "mouse-move"; sessionId?: string; x?: number; y?: number }
      | { action?: "scroll"; sessionId?: string; deltaY?: number }
      | { action?: "click"; sessionId?: string; x?: number; y?: number };

    switch (body.action) {
      case "start": {
        const url = body.url?.trim();
        if (!url) {
          return NextResponse.json({ message: "url required" }, { status: 400 });
        }

        const { browser, page } = await launchBrowserPage(url);
        await installHoverHighlight(page);

        const sessionId = createSessionId();
        storeSession(sessionId, { browser, page, createdAt: Date.now() });

        return NextResponse.json({ sessionId, viewport: VIEWPORT });
      }

      case "stop": {
        if (body.sessionId) {
          await closeSession(body.sessionId);
        }

        return NextResponse.json({ ok: true });
      }

      case "mouse-move": {
        const session = body.sessionId ? getSession(body.sessionId) : undefined;
        if (!session) {
          return NextResponse.json({ message: "session not found" }, { status: 404 });
        }

        await session.page.mouse.move(body.x ?? 0, body.y ?? 0);
        return NextResponse.json({ ok: true });
      }

      case "scroll": {
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
      }

      case "click": {
        const session = body.sessionId ? getSession(body.sessionId) : undefined;
        if (!session) {
          return NextResponse.json({ message: "session not found" }, { status: 404 });
        }

        const x = body.x ?? 0;
        const y = body.y ?? 0;

        await session.page.mouse.click(x, y, { delay: 40 });
        const info = await getElementInfoAtPoint(session.page, x, y);

        return NextResponse.json(info);
      }

      default:
        return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Browser action failed" },
      { status: 500 },
    );
  }
}
