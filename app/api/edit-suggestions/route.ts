import { NextResponse } from "next/server";
import { getWritingAgentConfig } from "@/lib/agent-config";
import { getEditSuggestions } from "@/lib/ai/edit-suggestions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draftHtml } = body as { draftHtml?: string };
    const html = typeof draftHtml === "string" ? draftHtml : "";
    const config = await getWritingAgentConfig();
    const suggestions = await getEditSuggestions(config, html);
    return NextResponse.json({ suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה בהצעות";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
