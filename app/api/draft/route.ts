import { NextResponse } from "next/server";
import { getWritingAgentConfig } from "@/lib/agent-config";
import { generateDraft, generateAllDrafts } from "@/lib/ai/draft";

/** זמן מרבי ליצירת טיוטה (שניות) – מודלים יכולים לקחת דקות */
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "גוף הבקשה לא בפורמט JSON תקין" },
        { status: 400 }
      );
    }
    const { title, description, outline, generateAll, validationWarnings } = (body && typeof body === "object" ? body : {}) as {
      title?: string;
      description?: string;
      outline?: string;
      generateAll?: boolean;
      validationWarnings?: string[];
    };
    if (!title) {
      return NextResponse.json(
        { error: "חסרה כותרת לרעיון" },
        { status: 400 }
      );
    }
    const config = await getWritingAgentConfig();
    const t = String(title);
    const d = String(description ?? "");
    const o = String(outline ?? "");

    const warnings = Array.isArray(validationWarnings)
      ? validationWarnings.filter((w) => typeof w === "string")
      : undefined;

    if (generateAll) {
      const result = await generateAllDrafts(config, t, d, o, warnings);
      return NextResponse.json(result);
    }

    const draft = await generateDraft(config, t, d, o, warnings);
    return NextResponse.json({ draft });
  } catch (e) {
    // לוג לדיבוג – ב־npm run dev יופיע בטרמינל; ב־Vercel ב־Function Logs
    console.error("[api/draft] Error:", e);
    const message = e instanceof Error ? e.message : "שגיאה ביצירת טיוטה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
