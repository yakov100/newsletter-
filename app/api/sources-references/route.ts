import { NextResponse } from "next/server";
import { getWritingAgentConfig } from "@/lib/agent-config";
import { getSourcesReferences } from "@/lib/ai/sources-references";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draftHtml } = body as { draftHtml?: string };
    const html = typeof draftHtml === "string" ? draftHtml : "";
    const config = await getWritingAgentConfig();
    const sources = await getSourcesReferences(config, html);
    return NextResponse.json({ sources });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה ביצירת מקורות";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
