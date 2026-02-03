import { NextResponse } from "next/server";
import { getWritingAgentConfig } from "@/lib/agent-config";
import { generateOutline } from "@/lib/ai/outline";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description } = body as { title?: string; description?: string };
    if (!title) {
      return NextResponse.json(
        { error: "חסרה כותרת לרעיון" },
        { status: 400 }
      );
    }
    const config = await getWritingAgentConfig();
    const outline = await generateOutline(
      config,
      String(title),
      String(description ?? "")
    );
    return NextResponse.json({ outline });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה ביצירת שלד";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
