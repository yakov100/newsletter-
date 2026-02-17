import { NextResponse } from "next/server";
import { getIdeasAgentConfig } from "@/lib/agent-config";
import { generateIdeas } from "@/lib/ai/ideas";
import { validateIdeas } from "@/lib/ai/validate-ideas";

const MAX_RETRIES = 2;

export async function POST() {
  try {
    const config = await getIdeasAgentConfig();
    let ideas = await generateIdeas(config);

    // Auto-validate ideas server-side; filter invalid and retry up to MAX_RETRIES times
    let validationResults = await validateIdeas(ideas);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const invalidCount = validationResults.filter((v) => !v.valid).length;
      if (invalidCount === 0) break;

      // Keep valid ideas, regenerate replacements for invalid ones
      const validIdeas = ideas.filter((_, i) => validationResults[i]?.valid !== false);
      const needed = 3 - validIdeas.length;
      if (needed <= 0) break;

      try {
        const extraIdeas = await generateIdeas(config);
        const replacements = extraIdeas.slice(0, needed);
        ideas = [...validIdeas, ...replacements].slice(0, 3);
        validationResults = await validateIdeas(ideas);
      } catch {
        // If regeneration fails, keep what we have
        break;
      }
    }

    return NextResponse.json({ ideas, validationResults });
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
