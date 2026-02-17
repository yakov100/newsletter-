import { NextResponse } from "next/server";
import { getIdeasAgentConfig } from "@/lib/agent-config";
import { generateIdeas } from "@/lib/ai/ideas";

export async function POST() {
  try {
    const config = await getIdeasAgentConfig();
    const ideas = await generateIdeas(config);

    // Return ideas immediately — validation runs client-side in SelectIdeaStage
    return NextResponse.json({ ideas });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה ביצירת רעיונות";
    const isExpected =
      message.includes("מפתח API") ||
      message.includes("לא הצלחנו לפרש") ||
      message.includes("אינה JSON");
    return NextResponse.json(
      { error: message },
      { status: isExpected ? 400 : 500 }
    );
  }
}
