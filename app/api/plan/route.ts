import { NextRequest, NextResponse } from "next/server";

import { generatePuppeteerScriptFromSelection } from "@/lib/server/script";
import type { ScriptRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ScriptRequestBody>;

    if (!body.url || !body.clickedElement) {
      return NextResponse.json(
        { message: "url and clickedElement required" },
        { status: 400 },
      );
    }

    const script = generatePuppeteerScriptFromSelection({
      url: body.url,
      element: body.clickedElement,
    });

    return NextResponse.json({ script });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Script generation failed" },
      { status: 500 },
    );
  }
}
