import { NextResponse } from "next/server";
import { getWritingAgentConfig } from "@/lib/agent-config";
import { expandText } from "@/lib/ai/expand-text";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body as { text?: string };
    const input = typeof text === "string" ? text : "";
    if (!input.trim()) {
      return NextResponse.json(
        { error: "חסר טקסט להרחבה" },
        { status: 400 }
      );
    }
    const config = await getWritingAgentConfig();
    const expanded = await expandText(config, input);
    return NextResponse.json({ expandedText: expanded });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה בהרחבת הטקסט";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
