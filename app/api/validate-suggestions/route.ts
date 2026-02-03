import { NextResponse } from "next/server";
import { validateSuggestions } from "@/lib/ai/validate-suggestions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draftHtml, suggestions } = body as {
      draftHtml?: string;
      suggestions?: string[];
    };
    const html = typeof draftHtml === "string" ? draftHtml : "";
    const list = Array.isArray(suggestions)
      ? suggestions.filter((s): s is string => typeof s === "string")
      : [];
    const results = await validateSuggestions(html, list);
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה בבדיקת ההצעות";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
