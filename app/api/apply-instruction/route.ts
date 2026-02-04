import { NextResponse } from "next/server";
import { getWritingAgentConfig } from "@/lib/agent-config";
import { applyInstruction } from "@/lib/ai/apply-instruction";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draftHtml, instruction } = body as {
      draftHtml?: string;
      instruction?: string;
    };
    const html = typeof draftHtml === "string" ? draftHtml : "";
    const instr = typeof instruction === "string" ? instruction.trim() : "";
    if (!instr) {
      return NextResponse.json(
        { error: "חסרה הוראה" },
        { status: 400 }
      );
    }
    const config = await getWritingAgentConfig();
    const result = await applyInstruction(config, html, instr);
    return NextResponse.json({ html: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה ביישום ההוראה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
