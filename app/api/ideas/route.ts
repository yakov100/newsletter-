import { NextResponse } from "next/server";
import { getIdeasAgentConfig } from "@/lib/agent-config";
import { generateIdeas } from "@/lib/ai/ideas";

export async function POST() {
  try {
    const config = await getIdeasAgentConfig();
    const ideas = await generateIdeas(config);
    return NextResponse.json({ ideas });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה ביצירת רעיונות";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
